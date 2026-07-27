import { expect, test } from "@playwright/test";

async function createReflectedAttempt(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.getByLabel("Bài tập JavaScript").fill(
    "Viết hàm cardCounter và giải thích cách count thay đổi",
  );
  await page.getByLabel("Phần tự làm").fill(
    "Tôi sẽ dùng if để cộng 1 cho lá nhỏ và trừ 1 cho lá lớn.",
  );
  await page.getByRole("button", { name: "Lưu lần làm" }).click();
  await page.getByRole("button", { name: "Ghi lỗi và bài học" }).click();
  await page.getByLabel("Sai ở đâu?").fill(
    "Tôi đã xếp lá 10 vào nhóm cộng điểm.",
  );
  await page.getByLabel("Học được gì?").fill(
    "Tách ba nhóm lá thành bảng trước khi viết điều kiện.",
  );
  await page.getByRole("button", { name: "Lưu phản tư" }).click();
}

test(
  "marks a reflection, hides previous work, saves a fresh retry and reloads it",
  async ({ page }, testInfo) => {
    await createReflectedAttempt(page);

    await page.getByRole("button", { name: "Đánh dấu cần làm lại" }).click();
    await expect(page.getByText("Cần làm lại")).toBeVisible();
    await page.getByRole("button", { name: "Làm lại ngay" }).click();

    await expect(page.getByTestId("retry-fresh-state")).toBeVisible();
    await expect(
      page.getByText("Phần tự làm, lỗi sai và bài học trước đang được ẩn."),
    ).toBeVisible();
    await expect(
      page.getByText("Tôi sẽ dùng if để cộng 1 cho lá nhỏ và trừ 1 cho lá lớn."),
    ).toHaveCount(0);
    await expect(page.getByText("Tôi đã xếp lá 10 vào nhóm cộng điểm.")).toHaveCount(0);
    await expect(
      page.getByText("Tách ba nhóm lá thành bảng trước khi viết điều kiện."),
    ).toHaveCount(0);

    await page.screenshot({
      path: testInfo.outputPath("retry-fresh-state.png"),
      fullPage: true,
    });

    await page.getByRole("button", { name: "Lưu lần thử mới" }).click();
    await expect(
      page.getByText("Hãy tự viết một lần thử mới trước khi xem lại phần cũ."),
    ).toBeVisible();

    await page.getByLabel("Lần thử mới").fill(
      "Tôi tách 2–6, 7–9 và 10–A trước rồi mới cập nhật count.",
    );
    await page.getByRole("button", { name: "Lưu lần thử mới" }).click();

    await expect(page.getByTestId("original-attempt")).toContainText(
      "Tôi sẽ dùng if để cộng 1",
    );
    await expect(page.getByTestId("reflection-summary")).toContainText(
      "xếp lá 10",
    );
    await expect(page.getByTestId("retry-history")).toContainText(
      "Tôi tách 2–6, 7–9 và 10–A",
    );
    await expect(
      page.getByText(
        "Đã lưu lần thử mới. Bây giờ bạn có thể so sánh với phần cũ.",
      ),
    ).toBeVisible();

    await page.reload();
    await expect(page.getByTestId("retry-history")).toContainText(
      "Tôi tách 2–6, 7–9 và 10–A",
    );
    await page.screenshot({
      path: testInfo.outputPath("retry-comparison-state.png"),
      fullPage: true,
    });
  },
);

test("keeps attempt, reflection and retry text inert", async ({ page }) => {
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
  await page.getByRole("button", { name: "Đánh dấu cần làm lại" }).click();
  await page.getByRole("button", { name: "Làm lại ngay" }).click();
  await page.getByLabel("Lần thử mới").fill(
    '<svg onload="window.retryBad = true"></svg>',
  );
  await page.getByRole("button", { name: "Lưu lần thử mới" }).click();

  await expect(page.getByTestId("attempt-card")).toContainText("<img src=x");
  await expect(page.getByTestId("reflection-summary")).toContainText("<script>");
  await expect(page.getByTestId("retry-history")).toContainText("<svg onload=");
  await expect(
    page.locator(".attempt-card img, .attempt-card script, .attempt-card svg"),
  ).toHaveCount(0);

  const executed = await page.evaluate(() => ({
    attempt: (window as typeof window & { __jplExecuted?: boolean })
      .__jplExecuted,
    reflection: (window as typeof window & { bad?: boolean }).bad,
    retry: (window as typeof window & { retryBad?: boolean }).retryBad,
  }));
  expect(executed.attempt).toBeUndefined();
  expect(executed.reflection).toBeUndefined();
  expect(executed.retry).toBeUndefined();
});
