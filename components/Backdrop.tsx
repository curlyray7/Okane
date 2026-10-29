/**
 * Fond animé.
 * - Onboarding : « aura de combat » (deux nappes de lumière qui dérivent + traits de vitesse qui tournent) et pétales.
 * - Partout : une nuée de pétales de sakura portée par le vent, comme une photo de cerisiers en fleur : formes variées
 *   (ovale, goutte, recourbé, fin, éventail), plusieurs roses, gros pétales flous au premier plan, petits pâles au fond.
 *   En cas d’alerte sur l’accueil, quelques pétales mélangent leur rose à --aura-tone (ambre si ça part vite, rouge si vide).
 * Purement décoratif, derrière le contenu ; masqué si le téléphone demande de réduire les animations.
 */

// Formes de pétale (viewBox 0 0 20 30), pour qu’ils ne se ressemblent pas tous.
const SHAPES = [
  // ovale
  "M10 1C15 1 18 8 17.5 15 17 23 13.5 29 10 29 6.5 29 3 23 2.5 15 2 8 5 1 10 1Z",
  // goutte
  "M10 .8C12.4 4.6 17.6 10.4 17.6 17.2 17.6 24 14 29 10 29S2.4 24 2.4 17.2C2.4 10.4 7.6 4.6 10 .8Z",
  // recourbé (pétale vu de biais, un bord plus creusé)
  "M5 1.5C11.5 2.6 17.2 8.6 17.6 16.4 18 23.6 15.2 28.6 11.6 29.2 12.8 21.6 11.2 12.6 5 1.5Z",
  // fin et allongé
  "M10 1C13.2 6 14.8 13 14.3 19.2 13.8 25.2 12 29 10 29S6.2 25.2 5.7 19.2C5.2 13 6.8 6 10 1Z",
  // éventail à petite encoche (pétale vu de face)
  "M10 29C6 25 2 18 2.5 11 3 5 6.5 2 9.3 2.6L10 3.8l.7-1.2C13.5 2 17 5 17.5 11 18 18 14 25 10 29Z",
];

const PINKS = ["var(--sakura-1)", "var(--sakura-2)", "var(--sakura-3)", "var(--sakura-4)"];

type Layer = "near" | "mid" | "far";
type Petal = {
  x: number;
  size: number;
  shape: number;
  color: string;
  fall: number;
  delay: number;
  drift: number;
  sway: number;
  swayTime: number;
  spin: number;
  tilt: number;
  axis: string;
  alpha: number;
  layer: Layer;
  tone: boolean;
};

/** Générateur pseudo-aléatoire à graine fixe : la nuée est irrégulière mais identique à chaque rendu. */
function seeded(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makePetals(): Petal[] {
  const rnd = seeded(2026);
  const pick = <T,>(list: T[]) => list[Math.floor(rnd() * list.length)];
  const layers: [Layer, number][] = [
    ["far", 20],
    ["mid", 22],
    ["near", 6],
  ];
  const out: Petal[] = [];
  for (const [layer, count] of layers) {
    for (let i = 0; i < count; i++) {
      const near = layer === "near";
      const far = layer === "far";
      out.push({
        x: rnd() * 110 - 15,
        size: far ? 5 + rnd() * 5 : near ? 22 + rnd() * 14 : 10 + rnd() * 8,
        shape: Math.floor(rnd() * SHAPES.length),
        color: far ? pick(PINKS.slice(0, 2)) : pick(PINKS),
        // Les pétales proches passent plus vite, ceux du fond flottent plus longtemps.
        fall: far ? 22 + rnd() * 10 : near ? 11 + rnd() * 5 : 15 + rnd() * 7,
        delay: rnd() * 30,
        drift: 10 + rnd() * 30,
        sway: 12 + rnd() * 30,
        swayTime: 2.5 + rnd() * 3,
        spin: 3 + rnd() * 6,
        tilt: Math.round(rnd() * 360),
        axis: `${(rnd() * 1.2 - 0.2).toFixed(2)}, ${(rnd() * 1.2 - 0.2).toFixed(2)}, ${(rnd() * 0.5).toFixed(2)}`,
        alpha: far ? 0.55 + rnd() * 0.2 : near ? 0.7 : 0.85 + rnd() * 0.15,
        layer,
        tone: rnd() < 0.22,
      });
    }
  }
  return out;
}

const PETALS = makePetals();

export function Backdrop({ variant }: { variant: "onboarding" | "app" }) {
  return (
    <div className="backdrop" aria-hidden="true">
      {variant === "onboarding" && (
        <>
          <div className="aura aura-a" />
          <div className="aura aura-b" />
          <div className="rays" />
        </>
      )}
      {PETALS.map((p, i) => {
        // --aura-tone n’existe qu’en cas d’alerte (enveloppe qui part vite ou vide) : sinon le pétale reste rose.
        const fill = p.tone ? `color-mix(in srgb, var(--aura-tone, ${p.color}) 40%, ${p.color})` : p.color;
        return (
          <div
            key={i}
            className="petal-fall"
            style={
              {
                left: `${p.x}%`,
                animationDuration: `${p.fall}s`,
                animationDelay: `-${p.delay}s`,
                filter: p.layer === "near" ? "blur(1.6px)" : p.layer === "far" ? "blur(0.4px)" : undefined,
                "--drift": `${p.drift}vw`,
                "--alpha": p.alpha,
              } as React.CSSProperties
            }
          >
            <div className="petal-sway" style={{ animationDuration: `${p.swayTime}s`, "--sway": `${p.sway}px` } as React.CSSProperties}>
              <div className="petal-spin" style={{ animationDuration: `${p.spin}s`, "--tilt": `${p.tilt}deg`, "--axis": p.axis } as React.CSSProperties}>
                <svg className="petal" width={p.size * 0.7} height={p.size} viewBox="0 0 20 30">
                  {/* Dégradé : bord plus clair, couleur pleine vers la base, comme un pétale éclairé. */}
                  <defs>
                    <linearGradient id={`petal-${i}`} x1="0.2" y1="0" x2="0.8" y2="1">
                      <stop offset="0" stopColor={`color-mix(in srgb, ${fill} 55%, white)`} />
                      <stop offset="1" stopColor={fill} />
                    </linearGradient>
                  </defs>
                  <path fill={`url(#petal-${i})`} d={SHAPES[p.shape]} />
                </svg>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
