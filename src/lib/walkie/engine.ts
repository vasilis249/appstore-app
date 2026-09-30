import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { blobToBase64, pickRecorderMime, silenceAll } from "@/lib/audio";
import { CHUNK_SAMPLES, decodeChunk, Downsampler, encodeChunk, WALKIE_RATE } from "./codec";

/**
 * One live walkie-talkie channel between two friends (Supabase Realtime, private channel `walkie:<a>:<b>`).
 *
 * Talking: the microphone runs through a ScriptProcessor → 16 kHz μ-law pieces of 0.25 s → binary broadcast
 * `audio`, framed by `start` / `end`. A MediaRecorder records the same voice so it can be saved (24 h replay).
 * Listening: pieces are scheduled on a Web Audio clock with a 0.3 s cushion (jitter buffer); a missing piece is
 * just a short gap. One speaker at a time: you can't press while the friend talks, and if both press at once the
 * later press gives way. Presence on the channel says whether the friend is there.
 *
 * A session may be shared (the walkie hub keeps "channel on" friends connected while you use the rest of the app,
 * and their walkie screen borrows the same session): listeners subscribe to changes and events.
 */

export const WALKIE_MAX_MS = 60_000;
const JITTER_S = 0.3;
const PEER_SILENT_MS = 1500; // no piece for this long = the friend's transmission ended (lost `end`)
const BEEP_S = 0.09;
const MIN_SAVE_MS = 500;

export type WalkieError = "denied" | "unsupported" | "channel";
export interface WalkieSnapshot {
  connected: boolean;
  peerOnline: boolean;
  /** Mic is starting (permission, hardware). */
  starting: boolean;
  /** You are on air. */
  talking: boolean;
  peerTalking: boolean;
  elapsedMs: number;
  /** iOS needs one tap before Web Audio may play. */
  audioLocked: boolean;
  error: WalkieError | null;
}

export function walkieTopic(a: string, b: string): string {
  return a < b ? `walkie:${a}:${b}` : `walkie:${b}:${a}`;
}

// ---------------------------------------------------------------------------------------------------------------
// One AudioContext for the app (iOS allows few), unlocked by a tap.
let ctx: AudioContext | null = null;
function audioContext(): AudioContext {
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new AC();
  }
  return ctx;
}

type AudioSessionType = "auto" | "playback" | "play-and-record" | "ambient";
/** Safari 16.4+: 'playback' plays through the silent switch; 'play-and-record' while the mic is on. */
function setAudioSession(type: AudioSessionType) {
  const s = (navigator as unknown as { audioSession?: { type: AudioSessionType } }).audioSession;
  if (s) {
    try {
      s.type = type;
    } catch {
      /* not supported */
    }
  }
}

/** Call inside a tap: lets Web Audio play (iOS) and plays nothing audible. */
export async function unlockWalkieAudio(): Promise<boolean> {
  const c = audioContext();
  try {
    const b = c.createBuffer(1, 1, 22050);
    const src = c.createBufferSource();
    src.buffer = b;
    src.connect(c.destination);
    src.start(0);
    await c.resume();
  } catch {
    /* ignore */
  }
  return c.state === "running";
}

/** Sessions connected right now (the audio session goes back to "auto" when the last one closes). */
const live = new Set<WalkieSession>();
const openSessions = () => live.size;

/** The shared AudioContext, when it can play (tests / UI hints). */
export function walkieAudioRunning(): boolean {
  return !!ctx && ctx.state === "running";
}

function beep(c: AudioContext, freq: number) {
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.12, c.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + BEEP_S);
  osc.connect(gain).connect(c.destination);
  osc.start();
  osc.stop(c.currentTime + BEEP_S);
}

// ---------------------------------------------------------------------------------------------------------------
interface Transmission {
  sid: string;
  at: number;
  seq: number;
  startedAt: number;
  stream: MediaStream;
  source: MediaStreamAudioSourceNode;
  proc: ScriptProcessorNode;
  sink: GainNode;
  down: Downsampler;
  pending: Float32Array;
  sendFrom: number; // AudioContext time: skip the beep
  recorder: MediaRecorder | null;
  recorded: Blob[];
  mime: string;
  timer: ReturnType<typeof setInterval>;
  aborted: boolean;
}

export type WalkieEvent = "saved" | "yield" | "peerStart";

interface Reception {
  sid: string;
  at: number;
  lastAt: number;
  playhead: number;
  ended: boolean;
}

export class WalkieSession {
  private channel: RealtimeChannel | null = null;
  private tx: Transmission | null = null;
  private rx: Reception | null = null;
  private watchdog: ReturnType<typeof setInterval> | null = null;
  private disposed = false;
  private listeners = new Set<(s: WalkieSnapshot) => void>();
  private handlers: Record<WalkieEvent, Set<() => void>> = { saved: new Set(), yield: new Set(), peerStart: new Set() };
  private snap: WalkieSnapshot = {
    connected: false,
    peerOnline: false,
    starting: false,
    talking: false,
    peerTalking: false,
    elapsedMs: 0,
    audioLocked: true,
    error: null,
  };

  constructor(
    readonly me: string,
    readonly peer: string,
  ) {}

  get snapshot() {
    return this.snap;
  }

  /** Changes of the snapshot. Returns the unsubscribe. */
  subscribe(fn: (s: WalkieSnapshot) => void): () => void {
    this.listeners.add(fn);
    return () => void this.listeners.delete(fn);
  }

  /**
   * saved: a transmission was saved (yours or the friend's) — refresh the history. yield: both pressed at once and
   * the friend was first. peerStart: the friend started talking.
   */
  on(event: WalkieEvent, fn: () => void): () => void {
    this.handlers[event].add(fn);
    return () => void this.handlers[event].delete(fn);
  }

  private emit(event: WalkieEvent) {
    this.handlers[event].forEach((fn) => fn());
  }

  private set(patch: Partial<WalkieSnapshot>) {
    this.snap = { ...this.snap, ...patch };
    if (!this.disposed) this.listeners.forEach((fn) => fn(this.snap));
  }

  connect() {
    live.add(this);
    setAudioSession("playback");
    this.set({ audioLocked: typeof window === "undefined" || audioContext().state !== "running" });
    const ch = supabase.channel(walkieTopic(this.me, this.peer), {
      config: { private: true, broadcast: { self: false }, presence: { key: this.me } },
    });
    ch.on("broadcast", { event: "start" }, ({ payload }) => this.onPeerStart(payload as { sid: string; at: number }))
      .on("broadcast", { event: "audio" }, ({ payload }) => this.onPeerAudio(payload as ArrayBuffer))
      .on("broadcast", { event: "end" }, ({ payload }) => this.onPeerEnd(payload as { sid: string }))
      .on("broadcast", { event: "saved" }, () => this.emit("saved"))
      .on("presence", { event: "sync" }, () => this.set({ peerOnline: (ch.presenceState()[this.peer]?.length ?? 0) > 0 }))
      .subscribe((status) => {
        if (this.disposed) return;
        if (status === "SUBSCRIBED") {
          this.set({ connected: true, error: null });
          void ch.track({ at: Date.now() });
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          this.set({ connected: false, error: "channel" });
        } else if (status === "CLOSED") {
          this.set({ connected: false });
        }
      });
    this.channel = ch;
    this.watchdog = setInterval(() => this.checkPeerSilence(), 500);
  }

  dispose() {
    this.disposed = true;
    live.delete(this);
    if (this.tx) this.finishTransmission(false);
    if (this.watchdog) clearInterval(this.watchdog);
    if (this.channel) {
      void this.channel.untrack();
      void supabase.removeChannel(this.channel);
    }
    this.channel = null;
    this.listeners.clear();
    Object.values(this.handlers).forEach((h) => h.clear());
    if (!openSessions()) setAudioSession("auto");
  }

  /** Tap handler: unlock playback on iOS. */
  async unlockAudio() {
    const ok = await unlockWalkieAudio();
    this.set({ audioLocked: !ok });
  }

  // ------------------------------------------------------------------------------------------------ talking ----
  /** Start talking (call from the press). Resolves false if busy, no microphone or not connected. */
  async press(): Promise<boolean> {
    if (this.tx || this.snap.starting || !this.channel || !this.snap.connected || this.snap.peerTalking) return false;
    const c = audioContext();
    void this.unlockAudio(); // the press is a gesture: good moment on iOS
    if (!navigator.mediaDevices?.getUserMedia || typeof c.createScriptProcessor !== "function") {
      this.set({ error: "unsupported" });
      return false;
    }
    silenceAll();
    setAudioSession("play-and-record");
    this.set({ starting: true });
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 },
      });
    } catch {
      setAudioSession("playback");
      this.set({ starting: false, error: "denied" });
      return false;
    }
    if (this.disposed || this.snap.peerTalking) {
      stream.getTracks().forEach((t) => t.stop());
      setAudioSession("playback");
      this.set({ starting: false });
      return false;
    }

    const source = c.createMediaStreamSource(stream);
    const proc = c.createScriptProcessor(4096, 1, 1);
    const sink = c.createGain();
    sink.gain.value = 0;
    source.connect(proc);
    proc.connect(sink).connect(c.destination);

    const mime = pickRecorderMime();
    let recorder: MediaRecorder | null = null;
    try {
      recorder = new MediaRecorder(stream, { ...(mime ? { mimeType: mime } : {}), audioBitsPerSecond: 32000 });
    } catch {
      recorder = null; // live only, nothing saved
    }
    const tx: Transmission = {
      sid: crypto.randomUUID(),
      at: Date.now(),
      seq: 0,
      startedAt: Date.now(),
      stream,
      source,
      proc,
      sink,
      down: new Downsampler(c.sampleRate),
      pending: new Float32Array(0),
      sendFrom: c.currentTime + BEEP_S,
      recorder,
      recorded: [],
      mime: (recorder?.mimeType || mime || "audio/mp4").split(";")[0],
      timer: setInterval(() => {
        const ms = Date.now() - tx.startedAt;
        this.set({ elapsedMs: ms });
        if (ms >= WALKIE_MAX_MS) this.release();
      }, 200),
      aborted: false,
    };
    if (recorder) {
      recorder.ondataavailable = (e) => e.data.size && tx.recorded.push(e.data);
      recorder.start(500);
    }
    proc.onaudioprocess = (e) => {
      if (this.tx !== tx || c.currentTime < tx.sendFrom) return;
      const s16 = tx.down.process(e.inputBuffer.getChannelData(0));
      const all = new Float32Array(tx.pending.length + s16.length);
      all.set(tx.pending);
      all.set(s16, tx.pending.length);
      let off = 0;
      for (; off + CHUNK_SAMPLES <= all.length; off += CHUNK_SAMPLES) this.sendAudio(tx, all.subarray(off, off + CHUNK_SAMPLES));
      tx.pending = all.slice(off);
    };
    this.tx = tx;
    beep(c, 880);
    void this.channel.send({ type: "broadcast", event: "start", payload: { sid: tx.sid, at: tx.at } });
    this.set({ starting: false, talking: true, elapsedMs: 0 });
    return true;
  }

  /** Stop talking (release). The voice is saved for 24 h replay. */
  release() {
    if (this.tx) this.finishTransmission(true);
  }

  private sendAudio(tx: Transmission, samples: Float32Array) {
    void this.channel?.send({ type: "broadcast", event: "audio", payload: encodeChunk(tx.seq++, samples) });
  }

  private finishTransmission(save: boolean) {
    const tx = this.tx;
    if (!tx) return;
    this.tx = null;
    clearInterval(tx.timer);
    if (tx.pending.length && !tx.aborted) this.sendAudio(tx, tx.pending);
    tx.proc.onaudioprocess = null;
    try {
      tx.source.disconnect();
      tx.proc.disconnect();
      tx.sink.disconnect();
    } catch {
      /* already */
    }
    const ms = Date.now() - tx.startedAt;
    void this.channel?.send({ type: "broadcast", event: "end", payload: { sid: tx.sid, ms } });
    const stopTracks = () => tx.stream.getTracks().forEach((t) => t.stop());
    const keep = save && !tx.aborted && ms >= MIN_SAVE_MS && tx.recorder;
    if (tx.recorder && tx.recorder.state !== "inactive") {
      tx.recorder.onstop = () => {
        stopTracks();
        if (keep) void this.save(tx, Math.min(ms, WALKIE_MAX_MS));
      };
      tx.recorder.stop();
    } else stopTracks();
    setAudioSession("playback");
    if (ctx) beep(ctx, 660);
    this.set({ talking: false, starting: false, elapsedMs: 0 });
  }

  private async save(tx: Transmission, ms: number) {
    if (!tx.recorded.length) return;
    try {
      const blob = new Blob(tx.recorded, { type: tx.mime });
      const { error } = await supabase.rpc("send_walkie", {
        p_to: this.peer,
        p_audio_b64: await blobToBase64(blob),
        p_mime: tx.mime,
        p_duration_ms: Math.round(ms),
      });
      if (error) throw error;
      this.emit("saved");
      void this.channel?.send({ type: "broadcast", event: "saved", payload: { sid: tx.sid } });
    } catch {
      /* live part already heard; the replay copy is best effort */
    }
  }

  // ---------------------------------------------------------------------------------------------- listening ----
  private onPeerStart(p: { sid: string; at: number }) {
    if (this.tx) {
      // Both pressed at once: the earlier press keeps the floor (ties: the smaller id).
      const peerFirst = p.at < this.tx.at || (p.at === this.tx.at && this.peer < this.me);
      if (!peerFirst) return;
      this.tx.aborted = true;
      this.finishTransmission(false);
      this.emit("yield");
    }
    this.rx = { sid: p.sid, at: p.at, lastAt: Date.now(), playhead: 0, ended: false };
    this.set({ peerTalking: true });
    this.emit("peerStart");
  }

  private onPeerAudio(buf: ArrayBuffer) {
    if (this.tx) return; // half duplex
    const chunk = decodeChunk(buf);
    if (!chunk) return;
    if (!this.rx || this.rx.ended) this.rx = { sid: "", at: Date.now(), lastAt: Date.now(), playhead: 0, ended: false };
    const rx = this.rx;
    rx.lastAt = Date.now();
    if (!this.snap.peerTalking) this.set({ peerTalking: true });
    const c = audioContext();
    if (c.state !== "running") {
      this.set({ audioLocked: true });
      return;
    }
    if (this.snap.audioLocked) this.set({ audioLocked: false }); // unlocked by a tap elsewhere
    const buffer = c.createBuffer(1, chunk.samples.length, WALKIE_RATE);
    buffer.copyToChannel(chunk.samples, 0);
    const src = c.createBufferSource();
    src.buffer = buffer;
    src.connect(c.destination);
    if (rx.playhead < c.currentTime + 0.02) rx.playhead = c.currentTime + JITTER_S;
    src.start(rx.playhead);
    rx.playhead += buffer.duration;
  }

  private onPeerEnd(_p: { sid: string }) {
    if (this.rx) this.rx.ended = true;
    this.finishReceptionSoon();
  }

  private checkPeerSilence() {
    if (this.rx && !this.rx.ended && Date.now() - this.rx.lastAt > PEER_SILENT_MS) {
      this.rx.ended = true;
      this.finishReceptionSoon();
    }
  }

  /** peerTalking goes off once what was scheduled has played. */
  private finishReceptionSoon() {
    const rx = this.rx;
    if (!rx) return;
    const left = ctx && ctx.state === "running" ? Math.max(0, rx.playhead - ctx.currentTime) : 0;
    setTimeout(() => {
      if (this.rx === rx && rx.ended) {
        this.rx = null;
        this.set({ peerTalking: false });
      }
    }, left * 1000 + 50);
  }
}
