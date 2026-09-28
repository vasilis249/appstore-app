// Normalization for fuzzy search (greeklish, diacritics, sport synonyms)

const GREEK_TO_LATIN: Record<string, string> = {
  α: "a", β: "v", γ: "g", δ: "d", ε: "e", ζ: "z", η: "i", θ: "th",
  ι: "i", κ: "k", λ: "l", μ: "m", ν: "n", ξ: "x", ο: "o", π: "p",
  ρ: "r", σ: "s", ς: "s", τ: "t", υ: "y", φ: "f", χ: "ch", ψ: "ps",
  ω: "o",
};

/** Lowercase + strip diacritics + greek→latin transliteration. */
export function normalize(input: string | null | undefined): string {
  if (!input) return "";
  // Strip diacritics
  const stripped = input.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const lower = stripped.toLowerCase();
  let out = "";
  for (const ch of lower) {
    out += GREEK_TO_LATIN[ch] ?? ch;
  }
  // Collapse common greeklish digraphs to a canonical form
  return out
    .replace(/ph/g, "f")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Map any normalized query token to a sport id, if it matches. */
export function matchSport(token: string): string | null {
  const SPORT_SYNONYMS: Record<string, string[]> = {
    padel: ["padel", "pantel", "padl"],
    tennis: ["tennis", "tenis"],
    basketball: ["basketball", "basket", "mpasket", "mpasketbol", "mpasketmpol"],
    football: ["football", "podosfairo", "podosfero", "soccer", "foot"],
    volleyball: ["volleyball", "volley", "voley", "volei", "volleybol"],
    beach_volley: ["beach", "beachvolley", "beachvoley", "beachvolei"],
  };
  for (const [sport, words] of Object.entries(SPORT_SYNONYMS)) {
    if (words.some((w) => token === w || token.includes(w))) return sport;
  }
  return null;
}
