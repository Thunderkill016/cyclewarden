import { expect, test } from "@playwright/test";

async function createAttempt(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.getByLabel("Bài tập JavaScript").fill(
    "Viết hàm cardCounter và giải thích cách count thay đổi",
  );
  await page.getByLabel("Phần tự làm").fill(
    "Tôi sẽ dùng if để cộng 1 cho lá nhỏ và trừ 1 cho lá lớn.",
  );
  await page.getByRole("button", { name: "Lưu lần làm" }).click();
}

test(
  "creates an attempt, adds reflection, reloads and edits it",
  async ({ page }, testInfo) => {
    await createAttempt(page);

    await page.getByRole("button", { name: "Ghi lỗi và bài học" }).click();
    await page.getByLabel("Sai ở đâu?").fill(
      "Tôi đã xếp lá 10 vào nhóm cộng điểm.",
    );
    await page.getByLabel("Học được gì?").fill(
      "Tách ba nhóm lá thành bảng trước khi viết điều kiện.",
    );
    await page.getByRole("button", { name: "Lưu phản tư" }).click();

    const reflection = page.getByTestId("reflection-summary");
    await expect(reflection).toContainText("xếp lá 10");
    await expect(reflection).toContainText("Tách ba nhóm lá");
    await expect(page.getByText("Đã lưu lỗi sai và điều học được.")).toBeVisible();

    await page.reload();
    await expect(page.getByTestId("reflection-summary")).toContainText(
      "Tách ba nhóm lá",
    );

    await page.getByRole("button", { name: "Chỉnh sửa phản tư" }).click();
    await expect(page.getByLabel("Sai ở đâu?")).toHaveValue(
      "Tôi đã xếp lá 10 vào nhóm cộng điểm.",
    );
    await page.getByLabel("Học được gì?").fill(
      "Tách rõ 2–6, 7–9 và 10–A trước khi code.",
    );
    await page.getByRole("button", { name: "Lưu phản tư" }).click();

    await expect(page.getByTestId("reflection-summary")).toContainText(
      "Tách rõ 2–6, 7–9 và 10–A",
    );
    await page.screenshot({
      path: testInfo.outputPath("reflection-saved-state.png"),
      fullPage: true,
    });
  },
);

test("keeps attempt and reflection text inert", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Bài tập JavaScript").fill("Kiểm tra dữ liệu an toàn");
  await page.getByLabel("Phần tự làm").fill(
    '<img src=x onerror="window.__jplExecuted = true">',
  );
  await page.getByRole("button", { name: "Lưu lần làm" }).click();
  await page.getByRole("button", { name: "Ghi lỗi và bài học" }).click();
  await page.getByLabel("Sai ở đâu?").fill("<script>window.bad = true</script>");
  await page.getByLabel("Học được gì?").fill("Luôn hiển thị dữ liệu như văn bản.");
  await page.getByRole("button", { name: "Lưu phản tư" }).click();

  await expect(page.getByTestId("attempt-card")).toContainText("<img src=x");
  await expect(page.getByTestId("reflection-summary")).toContainText("<script>");
  await expect(page.locator(".attempt-card img, .attempt-card script")).toHaveCount(0);

  const executed = await page.evaluate(
    () =>
      (window as typeof window & {
        __jplExecuted?: boolean;
        bad?: boolean;
      }),
  );
  expect(executed.__jplExecuted).toBeUndefined();
  expect(executed.bad).toBeUndefined();
});
