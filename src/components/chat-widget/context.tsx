import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

type ChatWidgetState = {
  panelOpen: boolean;
  openIds: string[]; // ordered, index 0 = front-most (right-most on desktop)
  minimized: Record<string, boolean>;
  togglePanel: () => void;
  closePanel: () => void;
  openPanel: () => void;
  openConversation: (id: string) => void;
  closeConversation: (id: string) => void;
  minimizeConversation: (id: string, value?: boolean) => void;
};

const Ctx = createContext<ChatWidgetState | null>(null);

const MAX_DESKTOP_WINDOWS = 3;

export function ChatWidgetProvider({ children }: { children: ReactNode }) {
  const [panelOpen, setPanelOpen] = useState(false);
  const [openIds, setOpenIds] = useState<string[]>([]);
  const [minimized, setMinimized] = useState<Record<string, boolean>>({});

  const togglePanel = useCallback(() => setPanelOpen((v) => !v), []);
  const closePanel = useCallback(() => setPanelOpen(false), []);
  const openPanel = useCallback(() => setPanelOpen(true), []);

  const openConversation = useCallback((id: string) => {
    setOpenIds((prev) => {
      const without = prev.filter((x) => x !== id);
      const next = [id, ...without].slice(0, MAX_DESKTOP_WINDOWS);
      return next;
    });
    setMinimized((m) => ({ ...m, [id]: false }));
    setPanelOpen(false);
  }, []);

  const closeConversation = useCallback((id: string) => {
    setOpenIds((prev) => prev.filter((x) => x !== id));
    setMinimized((m) => {
      const { [id]: _, ...rest } = m;
      return rest;
    });
  }, []);

  const minimizeConversation = useCallback((id: string, value?: boolean) => {
    setMinimized((m) => ({ ...m, [id]: value ?? !m[id] }));
  }, []);

  const value = useMemo<ChatWidgetState>(
    () => ({
      panelOpen,
      openIds,
      minimized,
      togglePanel,
      closePanel,
      openPanel,
      openConversation,
      closeConversation,
      minimizeConversation,
    }),
    [panelOpen, openIds, minimized, togglePanel, closePanel, openPanel, openConversation, closeConversation, minimizeConversation],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useChatWidget() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useChatWidget must be used within ChatWidgetProvider");
  return v;
}

export const CHAT_WIDGET_MAX_WINDOWS = MAX_DESKTOP_WINDOWS;
