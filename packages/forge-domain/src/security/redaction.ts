const SECRET_KEY_PATTERN = /(?:secret|token|password|passwd|private[_-]?key|api[_-]?key|access[_-]?key|authorization)/i;

const STRING_PATTERNS: ReadonlyArray<{
  name: string;
  pattern: RegExp;
}> = [
  { name: "private-key", pattern: /-----BEGIN(?: [A-Z]+)? PRIVATE KEY-----[\s\S]*?-----END(?: [A-Z]+)? PRIVATE KEY-----/g },
  { name: "github-token", pattern: /\b(?:github_pat_[A-Za-z0-9_]{20,}|gh[pousr]_[A-Za-z0-9]{20,})\b/g },
  { name: "openai-key", pattern: /\bsk-[A-Za-z0-9_-]{20,}\b/g },
  { name: "aws-access-key", pattern: /\bAKIA[0-9A-Z]{16}\b/g },
  { name: "bearer-token", pattern: /\bBearer\s+[A-Za-z0-9._~+\/-]+=*\b/gi },
  { name: "jwt", pattern: /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g },
  { name: "assignment", pattern: /\b(?:API_KEY|ACCESS_TOKEN|AUTH_TOKEN|PASSWORD|SECRET|PRIVATE_KEY)\s*=\s*[^\s'\"]+/gi },
];

export interface RedactionResult<T> {
  value: T;
  redactionCount: number;
}

function redactString(input: string): RedactionResult<string> {
  let value = input;
  let redactionCount = 0;

  for (const { name, pattern } of STRING_PATTERNS) {
    value = value.replace(pattern, () => {
      redactionCount += 1;
      return `[REDACTED:${name}]`;
    });
  }

  return { value, redactionCount };
}

export function redactSecrets<T>(input: T): RedactionResult<T> {
  if (typeof input === "string") {
    return redactString(input) as RedactionResult<T>;
  }

  if (Array.isArray(input)) {
    let redactionCount = 0;
    const value = input.map((item) => {
      const result = redactSecrets(item);
      redactionCount += result.redactionCount;
      return result.value;
    });
    return { value: value as T, redactionCount };
  }

  if (input && typeof input === "object") {
    let redactionCount = 0;
    const value: Record<string, unknown> = {};

    for (const [key, item] of Object.entries(input)) {
      if (SECRET_KEY_PATTERN.test(key) && item != null) {
        value[key] = "[REDACTED:secret-field]";
        redactionCount += 1;
        continue;
      }

      const result = redactSecrets(item);
      value[key] = result.value;
      redactionCount += result.redactionCount;
    }

    return { value: value as T, redactionCount };
  }

  return { value: input, redactionCount: 0 };
}
