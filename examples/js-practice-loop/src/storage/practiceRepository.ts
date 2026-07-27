import type {
  PracticeAttempt,
  PracticeReflection,
} from "../domain/practice";

const STORAGE_KEY = "js-practice-loop.attempts";
const SCHEMA_VERSION = 2;

interface PersistedPracticeState {
  schemaVersion: typeof SCHEMA_VERSION;
  attempts: PracticeAttempt[];
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function isReflection(value: unknown): value is PracticeReflection {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.mistake === "string" &&
    typeof candidate.lessonLearned === "string" &&
    typeof candidate.updatedAt === "string"
  );
}

function normalizeAttempt(value: unknown): PracticeAttempt | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  if (
    typeof candidate.id !== "string" ||
    typeof candidate.prompt !== "string" ||
    typeof candidate.ownAttempt !== "string" ||
    typeof candidate.createdAt !== "string"
  ) {
    return null;
  }

  const attempt: PracticeAttempt = {
    id: candidate.id,
    prompt: candidate.prompt,
    ownAttempt: candidate.ownAttempt,
    createdAt: candidate.createdAt,
  };

  if (candidate.reflection === undefined) {
    return attempt;
  }

  if (!isReflection(candidate.reflection)) {
    return null;
  }

  return {
    ...attempt,
    reflection: candidate.reflection,
  };
}

function emptyState(): PersistedPracticeState {
  return { schemaVersion: SCHEMA_VERSION, attempts: [] };
}

function readState(storage: StorageLike): PersistedPracticeState {
  const raw = storage.getItem(STORAGE_KEY);

  if (!raw) {
    return emptyState();
  }

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (
      !new Set([1, SCHEMA_VERSION]).has(Number(parsed.schemaVersion)) ||
      !Array.isArray(parsed.attempts)
    ) {
      return emptyState();
    }

    const attempts = parsed.attempts.map(normalizeAttempt);
    if (attempts.some((attempt) => attempt === null)) {
      return emptyState();
    }

    return {
      schemaVersion: SCHEMA_VERSION,
      attempts: attempts as PracticeAttempt[],
    };
  } catch {
    return emptyState();
  }
}

export class LocalPracticeRepository {
  constructor(private readonly storage: StorageLike) {}

  list(): PracticeAttempt[] {
    return [...readState(this.storage).attempts].sort((left, right) =>
      right.createdAt.localeCompare(left.createdAt),
    );
  }

  save(attempt: PracticeAttempt): void {
    const current = readState(this.storage);
    const withoutDuplicate = current.attempts.filter(
      (candidate) => candidate.id !== attempt.id,
    );

    const next: PersistedPracticeState = {
      schemaVersion: SCHEMA_VERSION,
      attempts: [attempt, ...withoutDuplicate],
    };

    this.storage.setItem(STORAGE_KEY, JSON.stringify(next));
  }
}

export const practiceStorageKey = STORAGE_KEY;
export const practiceSchemaVersion = SCHEMA_VERSION;
