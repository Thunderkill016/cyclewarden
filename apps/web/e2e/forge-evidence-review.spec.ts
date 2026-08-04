import { expect, test } from "@playwright/test";

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
  await page
    .getByLabel(/Describe the change/i)
    .fill("Add a reviewable account activity panel with deterministic validation.");
  await page.getByRole("button", { name: /Start governed run/i }).click();
  const runId = (await page.getByTestId("forge-run-id").innerText()).trim();
  expect(runId).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  );
  return runId;
}

test("reject iteration -> approve evidence -> create draft pull request", async ({
  page,
}) => {
  await authenticate(page);
  const firstRunId = await startFixtureRun(page);

  await page.goto(`/app/forge/runs/${firstRunId}/review`);
  await expect(page.getByTestId("forge-review-run-id")).toHaveText(firstRunId);
  await expect(page.getByTestId("forge-review-state")).toHaveText("queued");

  await page.getByTestId("forge-prepare-evidence").click();
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
  await page.getByTestId("forge-review-reject").click();
  await expect(page.getByTestId("forge-review-state")).toHaveText("completed");
  await expect(page.getByTestId("forge-next-iteration")).toBeVisible();

  await page.getByTestId("forge-next-iteration").click();
  await page.waitForURL(/\/app\/forge\/runs\/[0-9a-f-]+\/review$/i);
  const secondRunId = (await page.getByTestId("forge-review-run-id").innerText()).trim();
  expect(secondRunId).not.toBe(firstRunId);
  await expect(page.getByTestId("forge-review-state")).toHaveText("queued");

  await page.getByTestId("forge-prepare-evidence").click();
  await expect(page.getByTestId("forge-review-state")).toHaveText("awaiting_review");
  await page
    .getByLabel("Rationale")
    .fill("Mandatory evidence is complete and the exact redacted diff is approved.");
  await page.getByTestId("forge-review-approve").click();
  await expect(page.getByTestId("forge-publish")).toBeVisible();

  await page.getByTestId("forge-publish").click();
  await expect(page.getByTestId("forge-review-state")).toHaveText("completed");
  await expect(page.getByTestId("forge-publication-url")).toHaveAttribute(
    "href",
    /^https:\/\/example\.invalid\/atoryn-fixtures\/nextjs-app\/pull\/draft-/,
  );
  await expect(page.getByTestId("forge-publication-url")).toContainText("draft-");
});
