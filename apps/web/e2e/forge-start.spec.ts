import { expect, test } from "@playwright/test";

test("creates one reviewed Forge run from the responsive web flow", async ({ page }) => {
  await page.goto("/app/forge");
  await expect(page.getByRole("heading", { name: /Start one reviewable coding run/i })).toBeVisible();

  await page.getByLabel(/Describe the change/i).fill(
    "Add an account settings page with deterministic validation and English technical output.",
  );
  await page.getByRole("button", { name: /Start governed run/i }).click();

  await expect(page.getByText("Run queued.")).toBeVisible();
  await expect(page.getByTestId("forge-run-id")).toHaveText(
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  );
});
