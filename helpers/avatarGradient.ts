/**
 * avatarGradient — deterministic, vibrant gradient for initials avatars.
 *
 * Given a seed (the user's name or email) it always returns the same
 * good-looking gradient, so a merchant's avatar is stable across the app but
 * still colourful + full of personality (à la Linear / the Emergent panel).
 */
const AVATAR_GRADIENTS: Array<[string, string]> = [
  ["#7C5CFF", "#4FD1FF"], // violet → cyan (brand aurora)
  ["#F472B6", "#7C5CFF"], // pink → violet
  ["#FBBF24", "#FB7185"], // amber → rose
  ["#34D399", "#3B82F6"], // green → blue
  ["#22D3EE", "#6366F1"], // cyan → indigo
  ["#F59E0B", "#EF4444"], // orange → red
  ["#A855F7", "#EC4899"], // purple → pink
  ["#2DD4BF", "#0EA5E9"], // teal → sky
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
