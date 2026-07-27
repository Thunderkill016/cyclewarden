import { describe, expect, it } from "vitest";

import {
  createPracticeAttempt,
  updatePracticeReflection,
  validatePracticeAttempt,
  validatePracticeReflection,
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
});

describe("local practice repository", () => {
  it("persists schema-versioned attempts with reflection", () => {
    const storage = new MemoryStorage();
    const repository = new LocalPracticeRepository(storage);
    const reflected = updatePracticeReflection(
      baseAttempt,
      {
        mistake: "Dùng sai điều kiện dừng",
        lessonLearned: "Kiểm tra điều kiện bằng ví dụ nhỏ",
      },
      { now: () => new Date("2026-07-27T03:00:00.000Z") },
    );

    repository.save(reflected);

    expect(new LocalPracticeRepository(storage).list()).toEqual([reflected]);
    expect(JSON.parse(storage.getItem(practiceStorageKey) ?? "{}")).toEqual({
      schemaVersion: practiceSchemaVersion,
      attempts: [reflected],
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

    const reflected = updatePracticeReflection(
      repository.list()[0],
      {
        mistake: "Không tách từng trường hợp",
        lessonLearned: "Lập bảng trường hợp trước",
      },
      { now: () => new Date("2026-07-27T04:00:00.000Z") },
    );
    repository.save(reflected);

    const persisted = JSON.parse(storage.getItem(practiceStorageKey) ?? "{}");
    expect(persisted.schemaVersion).toBe(2);
    expect(persisted.attempts[0].reflection.lessonLearned).toBe(
      "Lập bảng trường hợp trước",
    );
  });

  it("edits an existing reflection without duplicating the attempt", () => {
    const storage = new MemoryStorage();
    const repository = new LocalPracticeRepository(storage);
    repository.save(baseAttempt);
    repository.save(
      updatePracticeReflection(baseAttempt, {
        mistake: "Sai lần đầu",
        lessonLearned: "Bài học lần đầu",
      }),
    );
    repository.save(
      updatePracticeReflection(baseAttempt, {
        mistake: "Sai đã sửa",
        lessonLearned: "Bài học đã sửa",
      }),
    );

    expect(repository.list()).toHaveLength(1);
    expect(repository.list()[0].reflection?.mistake).toBe("Sai đã sửa");
  });

  it("fails closed when stored JSON is malformed", () => {
    const storage = new MemoryStorage();
    storage.setItem(practiceStorageKey, "not-json");

    expect(new LocalPracticeRepository(storage).list()).toEqual([]);
  });
});
