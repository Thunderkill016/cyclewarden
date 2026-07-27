import type { PracticeAttempt } from "../domain/practice";

const STORAGE_KEY = "js-practice-loop.attempts";
const SCHEMA_VERSION = 1;

interface PersistedPracticeState {
  schemaVersion: typeof SCHEMA_VERSION;
  attempts: PracticeAttempt[];
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function isPracticeAttempt(value: unknown): value is PracticeAttempt {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate.id === "string" &&
    typeof candidate.prompt === "string" &&
    typeof candidate.ownAttempt === "string" &&
    typeof candidate.createdAt === "string"
  );
}

function readState(storage: StorageLike): PersistedPracticeState {
  const raw = storage.getItem(STORAGE_KEY);

  if (!raw) {
    return { schemaVersion: SCHEMA_VERSION, attempts: [] };
  }

  try {
    const parsed = JSON.parse(raw) as Partial<PersistedPracticeState>;

    if (
      parsed.schemaVersion !== SCHEMA_VERSION ||
      !Array.isArray(parsed.attempts) ||
      !parsed.attempts.every(isPracticeAttempt)
    ) {
      return { schemaVersion: SCHEMA_VERSION, attempts: [] };
    }

    return {
      schemaVersion: SCHEMA_VERSION,
      attempts: parsed.attempts,
    };
  } catch {
    return { schemaVersion: SCHEMA_VERSION, attempts: [] };
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
