import { expect, test } from "@playwright/test";

const portable =
  Boolean(process.env.DATABASE_URL) &&
  Boolean(process.env.BETTER_AUTH_SECRET) &&
  (process.env.AUTH_ADAPTER === "better-auth" || !process.env.AUTH_ADAPTER);

async function authenticateIfRequired(page: import("@playwright/test").Page) {
  if (!portable) return;
  const email = `forge_${Date.now()}@cyclewarden.test`;
  const password = "password12345";
  await page.goto("/login");
  const signUpForm = page
    .locator("form")
    .filter({ hasText: /create account|tạo tài khoản/i });
  await signUpForm.locator('input[name="email"]').fill(email);
  await signUpForm.locator('input[name="password"]').fill(password);
  await Promise.all([
    page.waitForURL(/\/app/, { timeout: 45_000 }),
    signUpForm
      .getByRole("button", { name: /create account|tạo tài khoản/i })
      .click(),
  ]);
}

test("creates one reviewed Forge run from the responsive web flow", async ({
  page,
}) => {
  await authenticateIfRequired(page);
  await page.goto("/app/forge");
  await expect(
    page.getByRole("heading", { name: /Start one reviewable coding run/i }),
  ).toBeVisible();

  await page.getByLabel(/Describe the change/i).fill(
    "Add an account settings page with deterministic validation and English technical output.",
  );
  await page.getByRole("button", { name: /Start governed run/i }).click();

  await expect(page.getByText("Run queued.")).toBeVisible();
  await expect(page.getByTestId("forge-run-id")).toHaveText(
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  );
  await expect(
    page.getByText(portable ? "durable PostgreSQL" : "demo memory"),
  ).toBeVisible();
});
