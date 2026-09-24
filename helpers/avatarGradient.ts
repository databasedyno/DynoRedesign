/**
 * avatarGradient — deterministic, vibrant gradient for initials avatars.
 *
 * Given a seed (the user's name or email) it always returns the same
 * good-looking gradient, so a merchant's avatar is stable across the app but
 * still colourful + full of personality (à la Linear / the Emergent panel).
 */
const AVATAR_GRADIENTS: Array<[string, string]> = [
  ["#121214", "#B8860B"], // espresso → dark gold (brand)
  ["#8B5E00", "#FFD100"], // deep gold → gold
  ["#B8860B", "#121214"], // dark gold → espresso
  ["#222227", "#8A6A1F"], // raised brown → bronze
  ["#6B4800", "#222227"], // bronze → brown
  ["#C2410C", "#121214"], // burnt orange → espresso
  ["#121214", "#8B5E00"], // ink → deep gold
  ["#B8860B", "#0A0A0D"], // dark gold → black
];

export function avatarGradient(seed?: string | null): string {
  const s = (seed || "?").trim().toLowerCase();
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) >>> 0;
  }
  const [a, b] = AVATAR_GRADIENTS[h % AVATAR_GRADIENTS.length];
  return `linear-gradient(135deg, ${a} 0%, ${b} 100%)`;
}

export default avatarGradient;
