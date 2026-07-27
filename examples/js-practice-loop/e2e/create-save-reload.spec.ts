import { expect, test } from "@playwright/test";

test(
  "creates, saves and reloads one practice attempt",
  async ({ page }, testInfo) => {
    await page.goto("/");

    await expect(
      page.getByRole("heading", { name: "Tự nghĩ trước, xem lời giải sau" }),
    ).toBeVisible();
    await expect(page.getByText("Chưa có lần làm nào")).toBeVisible();
    await page.screenshot({
      path: testInfo.outputPath("empty-state.png"),
      fullPage: true,
    });

    await page.getByLabel("Bài tập JavaScript").fill(
      "Viết hàm cardCounter và giải thích cách count thay đổi",
    );
    await page.getByLabel("Phần tự làm").fill(
      "Tôi sẽ dùng if để cộng 1 cho lá nhỏ và trừ 1 cho lá lớn.",
    );
    await page.getByRole("button", { name: "Lưu lần làm" }).click();

    const savedCard = page.getByTestId("attempt-card");
    await expect(savedCard).toContainText("Viết hàm cardCounter");
    await expect(savedCard).toContainText("Tôi sẽ dùng if để cộng 1");
    await expect(
      page.getByText("Đã lưu phần tự làm trên thiết bị này."),
    ).toBeVisible();
    await page.screenshot({
      path: testInfo.outputPath("saved-state.png"),
      fullPage: true,
    });

    await page.reload();

    await expect(page.getByTestId("attempt-card")).toContainText(
      "Viết hàm cardCounter",
    );
    await expect(page.getByTestId("attempt-card")).toContainText(
      "Tôi sẽ dùng if để cộng 1",
    );
  },
);

test("does not execute learner text as HTML or JavaScript", async ({ page }) => {
  await page.goto("/");

  await page
    .getByLabel("Bài tập JavaScript")
    .fill("Kiểm tra dữ liệu đầu vào an toàn");
  await page.getByLabel("Phần tự làm").fill(
    '<img src=x onerror="window.__jplExecuted = true">',
  );
  await page.getByRole("button", { name: "Lưu lần làm" }).click();

  await expect(page.getByTestId("attempt-card")).toContainText("<img src=x");
  await expect(page.locator(".attempt-card img")).toHaveCount(0);

  const executed = await page.evaluate(
    () =>
      (window as typeof window & { __jplExecuted?: boolean }).__jplExecuted,
  );
  expect(executed).toBeUndefined();
});
