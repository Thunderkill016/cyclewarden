export interface PracticeReflection {
  mistake: string;
  lessonLearned: string;
  updatedAt: string;
}

export interface PracticeRetry {
  id: string;
  ownAttempt: string;
  createdAt: string;
}

export interface PracticeAttempt {
  id: string;
  prompt: string;
  ownAttempt: string;
  createdAt: string;
  reflection?: PracticeReflection;
  needsRetry?: boolean;
  retries?: PracticeRetry[];
}

export interface NewPracticeAttempt {
  prompt: string;
  ownAttempt: string;
}

export interface PracticeValidationErrors {
  prompt?: string;
  ownAttempt?: string;
}

export interface PracticeReflectionInput {
  mistake: string;
  lessonLearned: string;
}

export interface PracticeReflectionErrors {
  mistake?: string;
  lessonLearned?: string;
}

export interface PracticeRetryInput {
  ownAttempt: string;
}

export interface PracticeRetryErrors {
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

export function validatePracticeReflection(
  input: PracticeReflectionInput,
): PracticeReflectionErrors {
  const errors: PracticeReflectionErrors = {};

  if (input.mistake.trim().length < 3) {
    errors.mistake = "Hãy ghi cụ thể điều bạn đã hiểu sai hoặc làm sai.";
  }

  if (input.lessonLearned.trim().length < 3) {
    errors.lessonLearned = "Hãy ghi điều bạn sẽ nhớ hoặc làm khác lần sau.";
  }

  return errors;
}

export function validatePracticeRetry(
  input: PracticeRetryInput,
): PracticeRetryErrors {
  if (input.ownAttempt.trim().length < 3) {
    return {
      ownAttempt: "Hãy tự viết một lần thử mới trước khi xem lại phần cũ.",
    };
  }

  return {};
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

export function updatePracticeReflection(
  attempt: PracticeAttempt,
  input: PracticeReflectionInput,
  options: { now?: () => Date } = {},
): PracticeAttempt {
  const errors = validatePracticeReflection(input);

  if (Object.keys(errors).length > 0) {
    throw new Error("Practice reflection is invalid.");
  }

  const now = options.now ?? (() => new Date());

  return {
    ...attempt,
    reflection: {
      mistake: input.mistake.trim(),
      lessonLearned: input.lessonLearned.trim(),
      updatedAt: now().toISOString(),
    },
  };
}

export function markPracticeAttemptForRetry(
  attempt: PracticeAttempt,
): PracticeAttempt {
  if (!attempt.reflection) {
    throw new Error("A reflection is required before retrying an attempt.");
  }

  return {
    ...attempt,
    needsRetry: true,
  };
}

export function appendPracticeRetry(
  attempt: PracticeAttempt,
  input: PracticeRetryInput,
  options: {
    createId?: () => string;
    now?: () => Date;
  } = {},
): PracticeAttempt {
  if (!attempt.reflection) {
    throw new Error("A reflection is required before retrying an attempt.");
  }

  const errors = validatePracticeRetry(input);
  if (Object.keys(errors).length > 0) {
    throw new Error("Practice retry is invalid.");
  }

  const createId = options.createId ?? (() => crypto.randomUUID());
  const now = options.now ?? (() => new Date());
  const retry: PracticeRetry = {
    id: createId(),
    ownAttempt: input.ownAttempt.trim(),
    createdAt: now().toISOString(),
  };

  return {
    ...attempt,
    needsRetry: false,
    retries: [...(attempt.retries ?? []), retry],
  };
}
