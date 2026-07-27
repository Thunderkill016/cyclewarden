export interface PracticeAttempt {
  id: string;
  prompt: string;
  ownAttempt: string;
  createdAt: string;
}

export interface NewPracticeAttempt {
  prompt: string;
  ownAttempt: string;
}

export interface PracticeValidationErrors {
  prompt?: string;
  ownAttempt?: string;
}

export function validatePracticeAttempt(
  input: NewPracticeAttempt,
): PracticeValidationErrors {
  const errors: PracticeValidationErrors = {};

  if (input.prompt.trim().length < 5) {
    errors.prompt = "Hãy ghi rõ đề bài hoặc mục tiêu cần giải.";
  }

  if (input.ownAttempt.trim().length < 3) {
    errors.ownAttempt = "Hãy ghi phần bạn đã tự nghĩ hoặc tự viết trước.";
  }

  return errors;
}

export function createPracticeAttempt(
  input: NewPracticeAttempt,
  options: {
    createId?: () => string;
    now?: () => Date;
  } = {},
): PracticeAttempt {
  const errors = validatePracticeAttempt(input);

  if (Object.keys(errors).length > 0) {
    throw new Error("Practice attempt is invalid.");
  }

  const createId = options.createId ?? (() => crypto.randomUUID());
  const now = options.now ?? (() => new Date());

  return {
    id: createId(),
    prompt: input.prompt.trim(),
    ownAttempt: input.ownAttempt.trim(),
    createdAt: now().toISOString(),
  };
}
