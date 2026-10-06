export type FeedbackKind = 'bug' | 'idea' | 'other';

export const FEEDBACK_MAX_LENGTH = 2_000;

export interface Diagnostics {
  appVersion: string;
  schemaVersion: number;
  platform: string;
  language: string;
}

export type FeedbackError = 'empty' | 'too-long';

export function validateFeedback(message: string): FeedbackError | null {
  const trimmed = message.trim();
  if (trimmed.length === 0) {
    return 'empty';
  }
  return trimmed.length > FEEDBACK_MAX_LENGTH ? 'too-long' : null;
}

const SUBJECTS: Record<FeedbackKind, string> = {
  bug: 'Problem report',
  idea: 'Idea',
  other: 'Feedback',
};

/**
 * Text ready to hand to any app that can send it. It never contains the person's data, only the
 * message they wrote and the technical details that help to reproduce a problem.
 */
export function composeFeedback(
  kind: FeedbackKind,
  message: string,
  diagnostics: Diagnostics,
  includeDiagnostics: boolean,
): { subject: string; body: string } {
  const lines = [message.trim()];
  if (includeDiagnostics) {
    lines.push(
      '',
      '---',
      `App version: ${diagnostics.appVersion}`,
      `Database version: ${diagnostics.schemaVersion}`,
      `Platform: ${diagnostics.platform}`,
      `Language: ${diagnostics.language}`,
    );
  }
  return {
    subject: `FocusFlow ${diagnostics.appVersion} – ${SUBJECTS[kind]}`,
    body: lines.join('\n'),
  };
}
