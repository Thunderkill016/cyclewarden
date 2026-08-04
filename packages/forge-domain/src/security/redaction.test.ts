import { describe, expect, it } from "vitest";

import { redactSecrets } from "./redaction.js";

describe("secret redaction", () => {
  it("redacts known token patterns from strings", () => {
    const result = redactSecrets(
      "Authorization: Bearer abcdefghijklmnopqrstuvwxyz and sk-abcdefghijklmnopqrstuvwxyz123456",
    );

    expect(result.value).not.toContain("abcdefghijklmnopqrstuvwxyz123456");
    expect(result.redactionCount).toBeGreaterThanOrEqual(2);
  });

  it("redacts nested secret fields without mutating safe fields", () => {
    const input = {
      command: "pnpm test",
      nested: {
        apiKey: "super-secret-value",
        message: "safe",
      },
    };

    const result = redactSecrets(input);
    expect(result.value).toEqual({
      command: "pnpm test",
      nested: {
        apiKey: "[REDACTED:secret-field]",
        message: "safe",
      },
    });
    expect(input.nested.apiKey).toBe("super-secret-value");
  });
});
