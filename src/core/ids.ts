const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz';
const RANDOM_LENGTH = 12;

/** Sortable-by-creation, collision-resistant local identifier (no network needed). */
export function createId(): string {
  let random = '';
  for (let i = 0; i < RANDOM_LENGTH; i += 1) {
    random += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return `${Date.now().toString(36)}${random}`;
}
