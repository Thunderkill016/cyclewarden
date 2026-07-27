import { FormEvent, useMemo, useState } from "react";

import {
  createPracticeAttempt,
  type PracticeValidationErrors,
  validatePracticeAttempt,
} from "./domain/practice";
import { LocalPracticeRepository } from "./storage/practiceRepository";

function formatCreatedAt(value: string): string {
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function App() {
  const repository = useMemo(
    () => new LocalPracticeRepository(window.localStorage),
    [],
  );
  const [attempts, setAttempts] = useState(() => repository.list());
  const [prompt, setPrompt] = useState("");
  const [ownAttempt, setOwnAttempt] = useState("");
  const [errors, setErrors] = useState<PracticeValidationErrors>({});
  const [status, setStatus] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const input = { prompt, ownAttempt };
    const nextErrors = validatePracticeAttempt(input);
    setErrors(nextErrors);
    setStatus("");

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    const attempt = createPracticeAttempt(input);
    repository.save(attempt);
    setAttempts(repository.list());
    setPrompt("");
    setOwnAttempt("");
    setStatus("Đã lưu phần tự làm trên thiết bị này.");
  }

  return (
    <main className="page-shell">
      <header className="hero">
        <p className="eyebrow">JS Practice Loop</p>
        <h1>Tự nghĩ trước, xem lời giải sau</h1>
        <p>
          Ghi lại đề bài và phần bạn đã tự làm. Ứng dụng chỉ lưu văn bản trên
          thiết bị này và không chạy code.
        </p>
      </header>

      <section className="panel" aria-labelledby="new-attempt-title">
        <div className="section-heading">
          <div>
            <p className="step-label">Bước hiện tại</p>
            <h2 id="new-attempt-title">Tạo một lần làm bài</h2>
          </div>
          <span className="local-badge">Lưu cục bộ</span>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <div className="field-group">
            <label htmlFor="prompt">Bài tập JavaScript</label>
            <textarea
              id="prompt"
              name="prompt"
              rows={4}
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              aria-describedby={errors.prompt ? "prompt-error" : "prompt-help"}
              aria-invalid={Boolean(errors.prompt)}
              placeholder="Ví dụ: Viết hàm cardCounter và giải thích vì sao count thay đổi."
            />
            {errors.prompt ? (
              <p id="prompt-error" className="field-error" role="alert">
                {errors.prompt}
              </p>
            ) : (
              <p id="prompt-help" className="field-help">
                Dán đề bài hoặc ghi mục tiêu bằng lời của bạn.
              </p>
            )}
          </div>

          <div className="field-group">
            <label htmlFor="own-attempt">Phần tự làm</label>
            <textarea
              id="own-attempt"
              name="ownAttempt"
              rows={7}
              value={ownAttempt}
              onChange={(event) => setOwnAttempt(event.target.value)}
              aria-describedby={
                errors.ownAttempt ? "attempt-error" : "attempt-help"
              }
              aria-invalid={Boolean(errors.ownAttempt)}
              placeholder="Ghi cách bạn đang nghĩ, giả mã hoặc code chưa hoàn chỉnh."
              spellCheck={false}
            />
            {errors.ownAttempt ? (
              <p id="attempt-error" className="field-error" role="alert">
                {errors.ownAttempt}
              </p>
            ) : (
              <p id="attempt-help" className="field-help">
                Chưa cần đúng. Mục tiêu là giữ lại suy nghĩ của bạn trước khi hỏi
                AI.
              </p>
            )}
          </div>

          <button className="primary-action" type="submit">
            Lưu lần làm
          </button>
          <p className="save-status" aria-live="polite">
            {status}
          </p>
        </form>
      </section>

      <section className="attempts-section" aria-labelledby="attempts-title">
        <div className="section-heading">
          <div>
            <p className="step-label">Đã lưu</p>
            <h2 id="attempts-title">Các lần làm gần đây</h2>
          </div>
          <span className="count-badge">{attempts.length}</span>
        </div>

        {attempts.length === 0 ? (
          <div className="empty-state">
            <h3>Chưa có lần làm nào</h3>
            <p>
              Bắt đầu bằng một bài thật đang làm. Không cần tạo cả kế hoạch học
              tập trước.
            </p>
          </div>
        ) : (
          <ol className="attempt-list">
            {attempts.map((attempt) => (
              <li key={attempt.id}>
                <article className="attempt-card" data-testid="attempt-card">
                  <p className="attempt-date">
                    {formatCreatedAt(attempt.createdAt)}
                  </p>
                  <h3>{attempt.prompt}</h3>
                  <pre>{attempt.ownAttempt}</pre>
                </article>
              </li>
            ))}
          </ol>
        )}
      </section>
    </main>
  );
}
