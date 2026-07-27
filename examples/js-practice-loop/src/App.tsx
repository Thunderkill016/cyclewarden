import { FormEvent, useMemo, useState } from "react";

import {
  appendPracticeRetry,
  createPracticeAttempt,
  markPracticeAttemptForRetry,
  type PracticeAttempt,
  type PracticeReflectionErrors,
  type PracticeValidationErrors,
  updatePracticeReflection,
  validatePracticeAttempt,
  validatePracticeReflection,
  validatePracticeRetry,
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
  const [editingAttemptId, setEditingAttemptId] = useState<string | null>(null);
  const [mistake, setMistake] = useState("");
  const [lessonLearned, setLessonLearned] = useState("");
  const [reflectionErrors, setReflectionErrors] =
    useState<PracticeReflectionErrors>({});
  const [reflectionStatus, setReflectionStatus] = useState<{
    attemptId: string;
    message: string;
  } | null>(null);
  const [retryingAttemptId, setRetryingAttemptId] = useState<string | null>(null);
  const [freshAttempt, setFreshAttempt] = useState("");
  const [retryError, setRetryError] = useState("");
  const [retryStatus, setRetryStatus] = useState<{
    attemptId: string;
    message: string;
  } | null>(null);

  function refreshAttempts() {
    setAttempts(repository.list());
  }

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
    refreshAttempts();
    setPrompt("");
    setOwnAttempt("");
    setStatus("Đã lưu phần tự làm trên thiết bị này.");
  }

  function startReflection(attempt: PracticeAttempt) {
    setEditingAttemptId(attempt.id);
    setMistake(attempt.reflection?.mistake ?? "");
    setLessonLearned(attempt.reflection?.lessonLearned ?? "");
    setReflectionErrors({});
    setReflectionStatus(null);
    setRetryStatus(null);
  }

  function cancelReflection() {
    setEditingAttemptId(null);
    setMistake("");
    setLessonLearned("");
    setReflectionErrors({});
  }

  function handleReflectionSubmit(
    event: FormEvent<HTMLFormElement>,
    attempt: PracticeAttempt,
  ) {
    event.preventDefault();

    const input = { mistake, lessonLearned };
    const nextErrors = validatePracticeReflection(input);
    setReflectionErrors(nextErrors);
    setReflectionStatus(null);
    setRetryStatus(null);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    repository.save(updatePracticeReflection(attempt, input));
    refreshAttempts();
    setEditingAttemptId(null);
    setMistake("");
    setLessonLearned("");
    setReflectionStatus({
      attemptId: attempt.id,
      message: "Đã lưu lỗi sai và điều học được.",
    });
  }

  function markForRetry(attempt: PracticeAttempt) {
    repository.save(markPracticeAttemptForRetry(attempt));
    refreshAttempts();
    setReflectionStatus(null);
    setRetryStatus({
      attemptId: attempt.id,
      message: "Đã thêm vào danh sách cần làm lại.",
    });
  }

  function startRetry(attempt: PracticeAttempt) {
    setRetryingAttemptId(attempt.id);
    setEditingAttemptId(null);
    setFreshAttempt("");
    setRetryError("");
    setReflectionStatus(null);
    setRetryStatus(null);
  }

  function cancelRetry() {
    setRetryingAttemptId(null);
    setFreshAttempt("");
    setRetryError("");
  }

  function handleRetrySubmit(
    event: FormEvent<HTMLFormElement>,
    attempt: PracticeAttempt,
  ) {
    event.preventDefault();

    const nextErrors = validatePracticeRetry({ ownAttempt: freshAttempt });
    setRetryError(nextErrors.ownAttempt ?? "");
    setReflectionStatus(null);
    setRetryStatus(null);

    if (nextErrors.ownAttempt) {
      return;
    }

    repository.save(
      appendPracticeRetry(attempt, { ownAttempt: freshAttempt }),
    );
    refreshAttempts();
    setRetryingAttemptId(null);
    setFreshAttempt("");
    setRetryError("");
    setRetryStatus({
      attemptId: attempt.id,
      message: "Đã lưu lần thử mới. Bây giờ bạn có thể so sánh với phần cũ.",
    });
  }

  return (
    <main className="page-shell">
      <header className="hero">
        <p className="eyebrow">JS Practice Loop</p>
        <h1>Tự nghĩ, rút kinh nghiệm, rồi thử lại</h1>
        <p>
          Ghi phần tự làm, lỗi sai và bài học. Khi làm lại, ứng dụng sẽ ẩn phần
          cũ cho tới khi bạn nộp một lần thử mới.
        </p>
      </header>

      <section className="panel" aria-labelledby="new-attempt-title">
        <div className="section-heading">
          <div>
            <p className="step-label">Bước 1</p>
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
            <p className="step-label">Bước 2–3</p>
            <h2 id="attempts-title">Rút kinh nghiệm và làm lại</h2>
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
            {attempts.map((attempt) => {
              const isEditing = editingAttemptId === attempt.id;
              const isRetrying = retryingAttemptId === attempt.id;
              const mistakeId = `mistake-${attempt.id}`;
              const lessonId = `lesson-${attempt.id}`;
              const retryId = `retry-${attempt.id}`;

              return (
                <li key={attempt.id}>
                  <article className="attempt-card" data-testid="attempt-card">
                    <div className="attempt-meta-row">
                      <p className="attempt-date">
                        {formatCreatedAt(attempt.createdAt)}
                      </p>
                      {attempt.needsRetry && !isRetrying ? (
                        <span className="retry-badge">Cần làm lại</span>
                      ) : null}
                    </div>
                    <h3>{attempt.prompt}</h3>

                    {isRetrying ? (
                      <div className="retry-panel" data-testid="retry-fresh-state">
                        <p className="retry-privacy-note">
                          Phần tự làm, lỗi sai và bài học trước đang được ẩn. Hãy
                          thử lại từ trí nhớ trước.
                        </p>
                        <form
                          onSubmit={(event) => handleRetrySubmit(event, attempt)}
                          noValidate
                        >
                          <div className="field-group">
                            <label htmlFor={retryId}>Lần thử mới</label>
                            <textarea
                              id={retryId}
                              rows={7}
                              value={freshAttempt}
                              onChange={(event) =>
                                setFreshAttempt(event.target.value)
                              }
                              aria-invalid={Boolean(retryError)}
                              aria-describedby={
                                retryError ? `${retryId}-error` : `${retryId}-help`
                              }
                              placeholder="Viết lại cách giải hoặc code mới mà không xem phần cũ."
                              spellCheck={false}
                            />
                            {retryError ? (
                              <p
                                id={`${retryId}-error`}
                                className="field-error"
                                role="alert"
                              >
                                {retryError}
                              </p>
                            ) : (
                              <p id={`${retryId}-help`} className="field-help">
                                Chỉ sau khi lưu, phần trước mới được hiện lại để so
                                sánh.
                              </p>
                            )}
                          </div>
                          <div className="reflection-actions">
                            <button className="reflection-save" type="submit">
                              Lưu lần thử mới
                            </button>
                            <button
                              className="text-action"
                              type="button"
                              onClick={cancelRetry}
                            >
                              Hủy
                            </button>
                          </div>
                        </form>
                      </div>
                    ) : (
                      <>
                        <pre data-testid="original-attempt">{attempt.ownAttempt}</pre>

                        {attempt.reflection ? (
                          <div
                            className="reflection-summary"
                            data-testid="reflection-summary"
                          >
                            <div className="reflection-block">
                              <h4>Sai ở đâu?</h4>
                              <p>{attempt.reflection.mistake}</p>
                            </div>
                            <div className="reflection-block">
                              <h4>Học được gì?</h4>
                              <p>{attempt.reflection.lessonLearned}</p>
                            </div>
                          </div>
                        ) : (
                          <p className="reflection-empty">
                            Chưa ghi lỗi sai và điều học được.
                          </p>
                        )}

                        {(attempt.retries?.length ?? 0) > 0 ? (
                          <div className="retry-history" data-testid="retry-history">
                            <h4>Các lần thử lại</h4>
                            <ol>
                              {attempt.retries?.map((retry, index) => (
                                <li key={retry.id}>
                                  <p className="attempt-date">
                                    Lần {index + 1} · {formatCreatedAt(retry.createdAt)}
                                  </p>
                                  <pre>{retry.ownAttempt}</pre>
                                </li>
                              ))}
                            </ol>
                          </div>
                        ) : null}

                        {isEditing ? (
                          <form
                            className="reflection-form"
                            onSubmit={(event) =>
                              handleReflectionSubmit(event, attempt)
                            }
                            noValidate
                          >
                            <div className="field-group">
                              <label htmlFor={mistakeId}>Sai ở đâu?</label>
                              <textarea
                                id={mistakeId}
                                rows={4}
                                value={mistake}
                                onChange={(event) => setMistake(event.target.value)}
                                aria-invalid={Boolean(reflectionErrors.mistake)}
                              />
                              {reflectionErrors.mistake ? (
                                <p className="field-error" role="alert">
                                  {reflectionErrors.mistake}
                                </p>
                              ) : null}
                            </div>

                            <div className="field-group">
                              <label htmlFor={lessonId}>Học được gì?</label>
                              <textarea
                                id={lessonId}
                                rows={4}
                                value={lessonLearned}
                                onChange={(event) =>
                                  setLessonLearned(event.target.value)
                                }
                                aria-invalid={Boolean(
                                  reflectionErrors.lessonLearned,
                                )}
                              />
                              {reflectionErrors.lessonLearned ? (
                                <p className="field-error" role="alert">
                                  {reflectionErrors.lessonLearned}
                                </p>
                              ) : null}
                            </div>

                            <div className="reflection-actions">
                              <button className="reflection-save" type="submit">
                                Lưu phản tư
                              </button>
                              <button
                                className="text-action"
                                type="button"
                                onClick={cancelReflection}
                              >
                                Hủy
                              </button>
                            </div>
                          </form>
                        ) : (
                          <div className="card-actions">
                            <button
                              className="secondary-action"
                              type="button"
                              onClick={() => startReflection(attempt)}
                            >
                              {attempt.reflection
                                ? "Chỉnh sửa phản tư"
                                : "Ghi lỗi và bài học"}
                            </button>

                            {attempt.reflection ? (
                              attempt.needsRetry ? (
                                <button
                                  className="retry-action"
                                  type="button"
                                  onClick={() => startRetry(attempt)}
                                >
                                  Làm lại ngay
                                </button>
                              ) : (
                                <button
                                  className="retry-action"
                                  type="button"
                                  onClick={() => markForRetry(attempt)}
                                >
                                  Đánh dấu cần làm lại
                                </button>
                              )
                            ) : null}
                          </div>
                        )}
                      </>
                    )}

                    <p className="save-status" aria-live="polite">
                      {retryStatus?.attemptId === attempt.id
                        ? retryStatus.message
                        : reflectionStatus?.attemptId === attempt.id
                          ? reflectionStatus.message
                          : ""}
                    </p>
                  </article>
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </main>
  );
}
