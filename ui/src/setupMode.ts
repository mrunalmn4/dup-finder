export type SetupMode = "simple" | "smart" | "guided" | "advanced";

const KEY = "dup.setupMode.v1";

const MODES: SetupMode[] = ["simple", "smart", "guided", "advanced"];

export function loadSetupMode(): SetupMode | null {
  try {
    const v = localStorage.getItem(KEY);
    if (v && (MODES as string[]).includes(v)) return v as SetupMode;
  } catch {
    /* ignore */
  }
  return null;
}

export function saveSetupMode(mode: SetupMode) {
  localStorage.setItem(KEY, mode);
}

export function clearSetupMode() {
  localStorage.removeItem(KEY);
}

export const MODE_CARDS: {
  id: SetupMode;
  title: string;
  blurb: string;
}[] = [
  {
    id: "simple",
    title: "Simple",
    blurb: "Pick places and scan. Extra options stay tucked away.",
  },
  {
    id: "smart",
    title: "Smart",
    blurb: "Start with your usual folders, then scan when ready.",
  },
  {
    id: "guided",
    title: "Guided",
    blurb: "Short steps: places → what to look for → scan.",
  },
  {
    id: "advanced",
    title: "Advanced",
    blurb: "Full controls — filters, profiles, restore, and index.",
  },
];
