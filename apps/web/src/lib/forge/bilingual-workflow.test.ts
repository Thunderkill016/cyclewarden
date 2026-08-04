import { describe, expect, it } from "vitest";

import { normalizeForgeInstruction } from "./instruction-normalization";
import {
  initialForgeLanguageState,
  switchForgeInterfaceLocale,
} from "./language-state";

describe("Forge bilingual workflow", () => {
  it("normalizes a Vietnamese task into an English technical instruction", () => {
    const normalized = normalizeForgeInstruction({
      instruction: "Thêm trang cài đặt tài khoản và giữ pull request bằng tiếng Anh.",
      instructionLanguage: "vi",
      technicalOutputLanguage: "en",
    });

    expect(normalized).toContain("Implement the user's requested change.");
    expect(normalized).toContain("branch names, commit messages, pull-request copy");
    expect(normalized).toContain("Thêm trang cài đặt tài khoản");
  });

  it("switches only the interface locale", () => {
    const next = switchForgeInterfaceLocale(initialForgeLanguageState, "en");

    expect(next).toEqual({
      interfaceLocale: "en",
      instructionLanguage: "vi",
      technicalOutputLanguage: "en",
    });
  });
});
