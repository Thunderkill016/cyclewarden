import { describe, expect, it } from "vitest";

import {
  appendPracticeRetry,
  createPracticeAttempt,
  markPracticeAttemptForRetry,
  updatePracticeReflection,
  validatePracticeAttempt,
  validatePracticeReflection,
  validatePracticeRetry,
} from "../src/domain/practice";
import {
  LocalPracticeRepository,
  practiceSchemaVersion,
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

const baseAttempt = createPracticeAttempt(
  {
    prompt: "Giải thích vòng lặp for",
    ownAttempt: "for bắt đầu, kiểm tra điều kiện rồi tăng biến",
  },
  {
    createId: () => "attempt-2",
    now: () => new Date("2026-07-27T01:00:00.000Z"),
  },
);

const reflectedAttempt = updatePracticeReflection(
  baseAttempt,
  {
    mistake: "Dùng sai điều kiện dừng",
    lessonLearned: "Kiểm tra điều kiện bằng ví dụ nhỏ",
  },
  { now: () => new Date("2026-07-27T03:00:00.000Z") },
);

describe("practice attempt domain", () => {
  it("requires both the exercise and the learner's own attempt", () => {
    expect(validatePracticeAttempt({ prompt: "", ownAttempt: "" })).toEqual({
      prompt: "Hãy ghi rõ đề bài hoặc mục tiêu cần giải.",
      ownAttempt: "Hãy ghi phần bạn đã tự nghĩ hoặc tự viết trước.",
    });
  });

  it("requires both mistake and lesson fields", () => {
    expect(
      validatePracticeReflection({ mistake: "", lessonLearned: "" }),
    ).toEqual({
      mistake: "Hãy ghi cụ thể điều bạn đã hiểu sai hoặc làm sai.",
      lessonLearned: "Hãy ghi điều bạn sẽ nhớ hoặc làm khác lần sau.",
    });
  });

  it("requires a fresh retry before previous work can be revealed", () => {
    expect(validatePracticeRetry({ ownAttempt: "" })).toEqual({
      ownAttempt: "Hãy tự viết một lần thử mới trước khi xem lại phần cũ.",
    });
  });

  it("trims and updates an editable reflection", () => {
    const reflected = updatePracticeReflection(
      baseAttempt,
      {
        mistake: "  Tôi quên cập nhật biến đếm  ",
        lessonLearned: "  Viết rõ từng bước trước khi code  ",
      },
      { now: () => new Date("2026-07-27T02:00:00.000Z") },
    );

    expect(reflected.reflection).toEqual({
      mistake: "Tôi quên cập nhật biến đếm",
      lessonLearned: "Viết rõ từng bước trước khi code",
      updatedAt: "2026-07-27T02:00:00.000Z",
    });
    expect(reflected.prompt).toBe(baseAttempt.prompt);
  });

  it("marks a reflected attempt and appends a fresh retry to the same record", () => {
    const marked = markPracticeAttemptForRetry(reflectedAttempt);
    const retried = appendPracticeRetry(
      marked,
      { ownAttempt: "  Tôi sẽ lập bảng ba nhóm trước rồi mới viết if.  " },
      {
        createId: () => "retry-1",
        now: () => new Date("2026-07-27T05:00:00.000Z"),
      },
    );

    expect(marked.needsRetry).toBe(true);
    expect(retried.id).toBe(reflectedAttempt.id);
    expect(retried.needsRetry).toBe(false);
    expect(retried.retries).toEqual([
      {
        id: "retry-1",
        ownAttempt: "Tôi sẽ lập bảng ba nhóm trước rồi mới viết if.",
        createdAt: "2026-07-27T05:00:00.000Z",
      },
    ]);
    expect(retried.reflection).toEqual(reflectedAttempt.reflection);
  });

  it("refuses retry marking before a reflection exists", () => {
    expect(() => markPracticeAttemptForRetry(baseAttempt)).toThrow(
      /reflection is required/i,
    );
  });
});

describe("local practice repository", () => {
  it("persists schema-versioned attempts with reflection and retries", () => {
    const storage = new MemoryStorage();
    const repository = new LocalPracticeRepository(storage);
    const retried = appendPracticeRetry(
      markPracticeAttemptForRetry(reflectedAttempt),
      { ownAttempt: "Thử lại bằng bảng trường hợp" },
      {
        createId: () => "retry-2",
        now: () => new Date("2026-07-27T06:00:00.000Z"),
      },
    );

    repository.save(retried);

    expect(new LocalPracticeRepository(storage).list()).toEqual([retried]);
    expect(JSON.parse(storage.getItem(practiceStorageKey) ?? "{}")).toEqual({
      schemaVersion: practiceSchemaVersion,
      attempts: [retried],
    });
  });

  it("loads schema v1 attempts and upgrades them on the next save", () => {
    const storage = new MemoryStorage();
    storage.setItem(
      practiceStorageKey,
      JSON.stringify({ schemaVersion: 1, attempts: [baseAttempt] }),
    );

    const repository = new LocalPracticeRepository(storage);
    expect(repository.list()).toEqual([baseAttempt]);
    repository.save(baseAttempt);

    const persisted = JSON.parse(storage.getItem(practiceStorageKey) ?? "{}");
    expect(persisted.schemaVersion).toBe(3);
  });

  it("loads schema v2 reflection records and upgrades them with retry state", () => {
    const storage = new MemoryStorage();
    storage.setItem(
      practiceStorageKey,
      JSON.stringify({ schemaVersion: 2, attempts: [reflectedAttempt] }),
    );

    const repository = new LocalPracticeRepository(storage);
    expect(repository.list()).toEqual([reflectedAttempt]);

    const retried = appendPracticeRetry(
      markPracticeAttemptForRetry(repository.list()[0]),
      { ownAttempt: "Lần này tôi tách điều kiện thành ba nhóm." },
      {
        createId: () => "retry-3",
        now: () => new Date("2026-07-27T07:00:00.000Z"),
      },
    );
    repository.save(retried);

    const persisted = JSON.parse(storage.getItem(practiceStorageKey) ?? "{}");
    expect(persisted.schemaVersion).toBe(3);
    expect(persisted.attempts[0].retries).toHaveLength(1);
    expect(persisted.attempts[0].needsRetry).toBe(false);
  });

  it("updates retry state without duplicating the original attempt", () => {
    const storage = new MemoryStorage();
    const repository = new LocalPracticeRepository(storage);
    repository.save(reflectedAttempt);
    repository.save(markPracticeAttemptForRetry(reflectedAttempt));
    repository.save(
      appendPracticeRetry(
        markPracticeAttemptForRetry(reflectedAttempt),
        { ownAttempt: "Một lần thử mới" },
      ),
    );

    expect(repository.list()).toHaveLength(1);
    expect(repository.list()[0].retries).toHaveLength(1);
  });

  it("fails closed when stored JSON is malformed", () => {
    const storage = new MemoryStorage();
    storage.setItem(practiceStorageKey, "not-json");

    expect(new LocalPracticeRepository(storage).list()).toEqual([]);
  });
});
