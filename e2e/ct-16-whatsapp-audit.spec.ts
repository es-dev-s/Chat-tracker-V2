import { expect, test } from "@playwright/test";
import { USERS } from "./seed";
import { setTime } from "./helpers";

// CT-16: Remove Day field from the Log WhatsApp Audit form (Chat Analyst).
test.use({ storageState: USERS.analyst.file });

test.describe("CT-16 Log WhatsApp Audit form", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/log-whatsapp-audit");
    await expect(page.getByRole("heading", { name: "Log WhatsApp Audit" })).toBeVisible();
  });

  test("has no Day field", async ({ page }) => {
    const form = page.locator("form.ct-wal-form");
    await expect(form.locator("#wal-date")).toBeVisible();
    await expect(form.getByText("Day", { exact: true })).toHaveCount(0);
    await expect(form.getByText("Filled from the date")).toHaveCount(0);
  });

  test("remaining fields still work and the audit saves", async ({ page }) => {
    const client = `E2E Client ${Date.now()}`;
    await page.locator("#wal-client").fill(client);
    await setTime(page, "Client message received time", "9", "15", "AM");
    await setTime(page, "Reply time", "9", "30", "AM");
    await page.getByRole("button", { name: "Save audit" }).click();

    await expect(page.getByRole("status")).toBeVisible();
    await expect(page.getByRole("row").filter({ hasText: client })).toBeVisible();
  });

  test("required fields are still enforced", async ({ page }) => {
    await page.getByRole("button", { name: "Save audit" }).click();
    await expect(page.getByText("Client name is required.").first()).toBeVisible();
  });
});
