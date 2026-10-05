const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz';

export function createId(): string {
  const time = Date.now().toString(36);
  let random = '';
  for (let i = 0; i < 10; i += 1) {
    random += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return `${time}${random}`;
}
