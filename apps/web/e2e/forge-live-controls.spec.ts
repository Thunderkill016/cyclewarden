import { expect, test } from "@playwright/test";

async function authenticate(page: import("@playwright/test").Page) {
  const email = `forge_controls_${Date.now()}@cyclewarden.test`;
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

test("desktop start -> disconnect -> mobile recover -> approve and cancel", async ({
  page,
  browser,
}) => {
  await authenticate(page);
  await page.goto("/app/forge");
  await page.getByLabel(/Describe the change/i).fill(
    "Add a responsive account activity panel with deterministic validation.",
  );
  await page.getByRole("button", { name: /Start governed run/i }).click();
  const runId = (await page.getByTestId("forge-run-id").innerText()).trim();
  expect(runId).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  );

  const signedInState = await page.context().storageState();
  await page.close();

  const mobileContext = await browser.newContext({
    storageState: signedInState,
    viewport: { width: 390, height: 844 },
  });
  const mobile = await mobileContext.newPage();
  await mobile.goto(`/app/forge/runs/${runId}`);

  await expect(mobile.getByTestId("forge-live-run-id")).toHaveText(runId);
  await expect(mobile.getByTestId("forge-run-state")).toHaveText("queued");
  await expect(mobile.locator('[data-event-sequence="1"]')).toBeVisible();

  await mobile
    .getByLabel("Additional instruction")
    .fill("Install a package registry dependency and rerun validation.");
  await mobile.getByRole("button", { name: "Send instruction" }).click();
  await expect(mobile.getByText("Approval requested")).toBeVisible();
  await expect(mobile.getByTestId("forge-pending-approvals")).toBeVisible();

  await mobile.getByRole("button", { name: "Approve" }).click();
  await expect(mobile.getByText("Approval resolved")).toBeVisible();
  await expect(mobile.getByTestId("forge-pending-approvals")).toHaveCount(0);

  await mobile.getByRole("button", { name: "Cancel run" }).click();
  await expect(mobile.getByTestId("forge-run-state")).toHaveText("cancelled");
  await expect(mobile.getByText("Cancellation requested")).toBeVisible();
  await expect(mobile.getByText("Run cancelled")).toBeVisible();
  await expect(mobile.getByTestId("forge-event-cursor")).toHaveText("6");

  await mobileContext.close();
});
