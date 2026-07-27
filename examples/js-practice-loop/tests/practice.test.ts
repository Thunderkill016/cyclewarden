import { describe, expect, it } from "vitest";

import {
  createPracticeAttempt,
  validatePracticeAttempt,
} from "../src/domain/practice";
import {
  LocalPracticeRepository,
  practiceStorageKey,
  type StorageLike,
} from "../src/storage/practiceRepository";

class MemoryStorage implements StorageLike {
  private readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

describe("practice attempt domain", () => {
  it("requires both the exercise and the learner's own attempt", () => {
    expect(validatePracticeAttempt({ prompt: "", ownAttempt: "" })).toEqual({
      prompt: "Hãy ghi rõ đề bài hoặc mục tiêu cần giải.",
      ownAttempt: "Hãy ghi phần bạn đã tự nghĩ hoặc tự viết trước.",
    });
  });

  it("trims plain text and creates stable metadata", () => {
    const attempt = createPracticeAttempt(
      {
        prompt: "  Viết hàm cardCounter  ",
        ownAttempt: "  count += 1  ",
      },
      {
        createId: () => "attempt-1",
        now: () => new Date("2026-07-27T00:00:00.000Z"),
      },
    );

    expect(attempt).toEqual({
      id: "attempt-1",
      prompt: "Viết hàm cardCounter",
      ownAttempt: "count += 1",
      createdAt: "2026-07-27T00:00:00.000Z",
    });
  });
});

describe("local practice repository", () => {
  it("persists schema-versioned attempts and reloads them", () => {
    const storage = new MemoryStorage();
    const repository = new LocalPracticeRepository(storage);
    const attempt = createPracticeAttempt(
      {
        prompt: "Giải thích vòng lặp for",
        ownAttempt: "for bắt đầu, kiểm tra điều kiện rồi tăng biến",
      },
      {
        createId: () => "attempt-2",
        now: () => new Date("2026-07-27T01:00:00.000Z"),
      },
    );

    repository.save(attempt);

    expect(new LocalPracticeRepository(storage).list()).toEqual([attempt]);
    expect(JSON.parse(storage.getItem(practiceStorageKey) ?? "{}")).toEqual({
      schemaVersion: 1,
      attempts: [attempt],
    });
  });

  it("fails closed when stored JSON is malformed", () => {
    const storage = new MemoryStorage();
    storage.setItem(practiceStorageKey, "not-json");

    expect(new LocalPracticeRepository(storage).list()).toEqual([]);
  });
});
