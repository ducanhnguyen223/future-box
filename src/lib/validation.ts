const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const MIN_PASSWORD_LENGTH = 6;

export function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email.trim());
}

export function isValidPassword(password: string): boolean {
  return password.length >= MIN_PASSWORD_LENGTH;
}

// --- Tạo hộp thời gian (Feature #2, #5) — theo AC #2 trong PRD.md ---

export const MAX_CONTENT_TEXT_LENGTH = 2000;
export const MAX_FOLLOW_UP_QUESTION_LENGTH = 200;
export const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
export const ALLOWED_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png'] as const;

export function isValidBoxContentText(text: string): boolean {
  const length = text.trim().length;
  return length >= 1 && length <= MAX_CONTENT_TEXT_LENGTH;
}

export function isFutureOpenAt(date: Date): boolean {
  return date.getTime() > Date.now();
}

export function isValidFollowUpQuestion(question: string): boolean {
  return question.trim().length <= MAX_FOLLOW_UP_QUESTION_LENGTH;
}

export function isValidBoxImage(image: { sizeBytes: number; mimeType: string }): boolean {
  return (
    image.sizeBytes > 0 &&
    image.sizeBytes <= MAX_IMAGE_SIZE_BYTES &&
    (ALLOWED_IMAGE_MIME_TYPES as readonly string[]).includes(image.mimeType)
  );
}
