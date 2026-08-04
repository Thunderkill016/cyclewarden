import { expect, test } from "@playwright/test";

const portable =
  Boolean(process.env.DATABASE_URL) &&
  Boolean(process.env.BETTER_AUTH_SECRET) &&
  (process.env.AUTH_ADAPTER === "better-auth" || !process.env.AUTH_ADAPTER);

test.skip(!portable, "durable evidence review requires Better Auth and PostgreSQL");

async function authenticate(page: import("@playwright/test").Page) {
  const email = `forge_review_${Date.now()}@cyclewarden.test`;
  await page.goto("/login");
  const signUpForm = page
    .locator("form")
    .filter({ hasText: /create account|tạo tài khoản/i });
  await signUpForm.locator('input[name="email"]').fill(email);
  await signUpForm.locator('input[name="password"]').fill("password12345");
  await Promise.all([
    page.waitForURL(/\/app/, { timeout: 45_000 }),
    signUpForm
      .getByRole("button", { name: /create account|tạo tài khoản/i })
      .click(),
  ]);
}

async function startFixtureRun(page: import("@playwright/test").Page) {
  await page.goto("/app/forge");
  await expect(page.locator('select[name="instructionLanguage"]')).toHaveValue("vi");
  await expect(page.locator('select[name="technicalOutputLanguage"]')).toHaveValue("en");

  await page.getByTestId("forge-locale-en").click();
  await expect(page.getByTestId("forge-interface-locale")).toHaveValue("en");
  await expect(page.locator('select[name="instructionLanguage"]')).toHaveValue("vi");
  await expect(page.locator('select[name="technicalOutputLanguage"]')).toHaveValue("en");

  await page
    .getByLabel(/Describe the change/i)
    .fill("Thêm bảng hoạt động tài khoản có thể kiểm duyệt và xác thực ổn định.");
  await page.getByRole("button", { name: /Start governed run/i }).click();
  const runId = (await page.getByTestId("forge-run-id").innerText()).trim();
  expect(runId).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  );
  return runId;
}

async function assertNoReviewError(page: import("@playwright/test").Page) {
  const error = page.getByTestId("forge-review-error");
  await page.waitForTimeout(500);
  if (await error.isVisible()) {
    throw new Error(await error.innerText());
  }
}

test("Vietnamese task -> reject iteration -> approve English artifacts -> draft pull request", async ({
  page,
}) => {
  await authenticate(page);
  const firstRunId = await startFixtureRun(page);

  await page.goto(`/app/forge/runs/${firstRunId}/review`);
  await expect(page.getByTestId("forge-review-run-id")).toHaveText(firstRunId);
  await expect(page.getByTestId("forge-review-state")).toHaveText("queued");
  await expect(page.getByTestId("forge-instruction-trace")).toContainText(
    "Thêm bảng hoạt động tài khoản",
  );
  await expect(page.getByTestId("forge-normalized-objective")).toContainText(
    "Implement the user's requested change.",
  );
  await expect(page.getByTestId("forge-normalized-objective")).toContainText(
    "branch names, commit messages, pull-request copy",
  );

  await page.getByTestId("forge-prepare-evidence").click();
  await assertNoReviewError(page);
  await expect(page.getByTestId("forge-review-state")).toHaveText("awaiting_review");
  await expect(page.getByTestId("forge-unified-diff")).toContainText(
    "src/atoryn-task.ts",
  );
  await expect(page.getByTestId("forge-evidence-gate")).toHaveText(
    "approval ready",
  );

  await page
    .getByLabel("Rationale")
    .fill("The first iteration needs a clearer implementation boundary.");
  const rejectionResponsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      response.url().endsWith(`/api/forge/runs/${firstRunId}/review`),
  );
  await page.getByTestId("forge-review-reject").click();
  const rejectionResponse = await rejectionResponsePromise;
  const rejectionPayload = (await rejectionResponse.json()) as {
    ok?: boolean;
    state?: string;
    errorCode?: string;
    error?: string;
    view?: { run?: { state?: string } };
  };
  expect(
    rejectionResponse.ok(),
    JSON.stringify(rejectionPayload),
  ).toBeTruthy();
  expect(rejectionPayload.state, JSON.stringify(rejectionPayload)).toBe("completed");
  expect(rejectionPayload.view?.run?.state, JSON.stringify(rejectionPayload)).toBe(
    "completed",
  );
  await assertNoReviewError(page);
  await expect(page.getByTestId("forge-review-state")).toHaveText("completed");
  await expect(page.getByTestId("forge-next-iteration")).toBeVisible();

  const firstReviewPath = `/app/forge/runs/${firstRunId}/review`;
  await Promise.all([
    page.waitForURL((url) => {
      return (
        url.pathname !== firstReviewPath &&
        /^\/app\/forge\/runs\/[0-9a-f-]+\/review$/i.test(url.pathname)
      );
    }),
    page.getByTestId("forge-next-iteration").click(),
  ]);
  const secondRunId = (await page.getByTestId("forge-review-run-id").innerText()).trim();
  expect(secondRunId).not.toBe(firstRunId);
  await expect(page.getByTestId("forge-review-state")).toHaveText("queued");
  await expect(page.getByTestId("forge-instruction-trace")).toContainText(
    "Thêm bảng hoạt động tài khoản",
  );

  await page.getByTestId("forge-prepare-evidence").click();
  await assertNoReviewError(page);
  await expect(page.getByTestId("forge-review-state")).toHaveText("awaiting_review");
  await page
    .getByLabel("Rationale")
    .fill("Mandatory evidence is complete and the exact redacted diff is approved.");
  await page.getByTestId("forge-review-approve").click();
  await assertNoReviewError(page);
  await expect(page.getByTestId("forge-publish")).toBeVisible();

  await page.getByTestId("forge-publish").click();
  await assertNoReviewError(page);
  await expect(page.getByTestId("forge-review-state")).toHaveText("completed");
  await expect(page.getByTestId("forge-publication-url")).toHaveAttribute(
    "href",
    /^https:\/\/example\.invalid\/atoryn-fixtures\/nextjs-app\/pull\/draft-/,
  );
  await expect(page.getByTestId("forge-publication-url")).toContainText("draft-");
});
