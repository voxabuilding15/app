/**
 * Marks a phrase that is translated later, where it is shown (`t(option.label)`). It returns the
 * text unchanged; the translation tooling uses the marker to know the phrase is needed.
 */
export function msg(text: string): string {
  return text;
}
