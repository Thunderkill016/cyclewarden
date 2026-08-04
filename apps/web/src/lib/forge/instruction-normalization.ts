import type { Locale } from "@cyclewarden/i18n";

export interface ForgeInstructionLanguages {
  instructionLanguage: Locale;
  technicalOutputLanguage: Locale;
}

export function normalizeForgeInstruction(input: {
  instruction: string;
} & ForgeInstructionLanguages): string {
  const original = input.instruction.trim();
  if (input.instructionLanguage === input.technicalOutputLanguage) {
    return original;
  }

  if (input.technicalOutputLanguage === "en") {
    return [
      "Implement the user's requested change.",
      "Keep code identifiers, branch names, commit messages, pull-request copy, and technical summaries in English.",
      "Preserve the original Vietnamese instruction as authoritative context:",
      original,
    ].join("\n\n");
  }

  return [
    "Triển khai thay đổi người dùng yêu cầu.",
    "Giữ tên nhánh, commit, nội dung pull request và tóm tắt kỹ thuật bằng tiếng Việt.",
    "Bảo toàn yêu cầu tiếng Anh gốc làm ngữ cảnh có thẩm quyền:",
    original,
  ].join("\n\n");
}
