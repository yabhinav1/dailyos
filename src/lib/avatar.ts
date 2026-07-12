/**
 * Generates fun, deterministic "robot face" default avatars (DiceBear's
 * bottts-neutral style — the same family of cute robot avatars) so every
 * new user gets a random profile picture instead of a blank initials
 * circle.
 *
 * Passing the same seed always returns the same image, so we seed with
 * something stable (username) at signup, and with a fresh random string
 * whenever the user wants to "reroll" their avatar.
 */
export function generateAvatarUrl(seed: string): string {
  const encodedSeed = encodeURIComponent(seed);
  return `https://api.dicebear.com/9.x/bottts-neutral/svg?seed=${encodedSeed}&backgroundType=gradientLinear`;
}

/** Random seed for "give me a new random avatar" actions. */
export function randomAvatarSeed(): string {
  return Math.random().toString(36).slice(2, 12) + Date.now().toString(36);
}
