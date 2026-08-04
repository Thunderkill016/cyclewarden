export function TaskComposer() {
  return (
    <fieldset className="space-y-4 rounded-2xl border border-border bg-card p-5">
      <legend className="px-2 text-sm font-semibold text-foreground">
        2. Task / Yêu cầu phát triển
      </legend>
      <label className="block text-sm text-muted">
        Describe the change / Mô tả thay đổi
        <textarea
          name="instruction"
          required
          minLength={10}
          maxLength={10_000}
          rows={7}
          placeholder="Ví dụ: Thêm trang cài đặt tài khoản, giữ code và commit bằng tiếng Anh…"
          className="mt-2 w-full resize-y rounded-xl border border-border bg-background px-4 py-3 text-sm leading-relaxed text-foreground outline-none transition-colors focus:border-accent"
        />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm text-muted">
          Instruction language / Ngôn ngữ yêu cầu
          <select
            name="instructionLanguage"
            defaultValue="vi"
            className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-2 text-foreground outline-none focus:border-accent"
          >
            <option value="vi">Tiếng Việt</option>
            <option value="en">English</option>
          </select>
        </label>
        <label className="text-sm text-muted">
          Technical output / Ngôn ngữ kỹ thuật
          <select
            name="technicalOutputLanguage"
            defaultValue="en"
            className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-2 text-foreground outline-none focus:border-accent"
          >
            <option value="en">English</option>
            <option value="vi">Tiếng Việt</option>
          </select>
        </label>
      </div>
    </fieldset>
  );
}
