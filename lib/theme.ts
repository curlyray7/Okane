export type ThemeChoice = "auto" | "light" | "dark";

export const THEME_KEY = "okane:theme";

/** Script lancé avant l’affichage pour appliquer le thème choisi sans flash. */
export const themeBootScript = `try{var t=localStorage.getItem("${THEME_KEY}");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;

export function readTheme(): ThemeChoice {
  try {
    const t = localStorage.getItem(THEME_KEY);
    return t === "light" || t === "dark" ? t : "auto";
  } catch {
    return "auto";
  }
}

/** Applique le thème (« auto » suit le réglage du téléphone) et le retient pour cet appareil. */
export function applyTheme(t: ThemeChoice) {
  if (t === "auto") delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = t;
  try {
    if (t === "auto") localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, t);
  } catch {
    /* préférence non retenue, le thème s’applique quand même pour cette visite */
  }
}
