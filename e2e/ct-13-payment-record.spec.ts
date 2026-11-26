import { expect, test, type Page } from "@playwright/test";
import { USERS } from "./seed";
import { dmy, fillDate, isoDaysAgo, pick } from "./helpers";

// CT-13: Payment Record form uses Payment Date, Payment Type and Payment Amount.

async function openAddDialog(page: Page) {
  await page.goto("/payment-records");
  await page.getByRole("button", { name: "Add Record" }).click();
  const dialog = page.getByRole("dialog", { name: "Add Payment Record" });
  await expect(dialog).toBeVisible();
  return dialog;
}

test.describe("CT-13 Payment Record form (Chat Analyst)", () => {
  test.use({ storageState: USERS.analyst.file });

  test("shows Payment Date and Payment Type; old fields are gone", async ({ page }) => {
    const dialog = await openAddDialog(page);
    await expect(dialog.getByText("Payment Date", { exact: true })).toBeVisible();
    await expect(dialog.getByText("Payment Type", { exact: true })).toBeVisible();
    for (const old of ["From Date", "To Date", "Total Payment Amount (AUD)", "Initial Payment (AUD)", "Final Payment (AUD)"]) {
      await expect(dialog.getByText(old, { exact: true })).toHaveCount(0);
    }
  });

  test("dropdown lists the two payment types; amount appears only after choosing one", async ({ page }) => {
    const dialog = await openAddDialog(page);
    await expect(dialog.locator("#pay-amount")).toHaveCount(0);

    await dialog.getByRole("button", { name: "Payment Type" }).click();
    const options = page.getByRole("listbox").getByRole("option");
    await expect(options).toHaveText(["Select payment type", "Initial Payment (AUD)", "Final Payment (AUD)"]);
    await options.filter({ hasText: "Initial Payment (AUD)" }).click();

    await expect(dialog.getByText("Payment Amount (AUD)", { exact: true })).toBeVisible();
    await expect(dialog.locator("#pay-amount")).toBeEditable();
  });

  test("required fields are enforced", async ({ page }) => {
    const dialog = await openAddDialog(page);
    await dialog.getByRole("button", { name: "Save Record" }).click();
    await expect(dialog.getByText("Payment Date is required.")).toBeVisible();
    await expect(dialog.getByText("Payment Type is required.")).toBeVisible();
    await expect(dialog.getByText("Client Name is required.")).toBeVisible();

    await pick(dialog.getByRole("button", { name: "Payment Type" }), "Final Payment (AUD)");
    await dialog.getByRole("button", { name: "Save Record" }).click();
    await expect(dialog.getByText("Payment Amount is required.")).toBeVisible();
  });

  test("saves a payment with its date, type and amount", async ({ page }) => {
    const date = isoDaysAgo(2);
    const client = `E2E Pay ${Date.now()}`;
    const dialog = await openAddDialog(page);

    await fillDate(page, "pay-date", date);
    await pick(dialog.getByRole("button", { name: "Payment Type" }), "Final Payment (AUD)");
    await dialog.locator("#pay-amount").fill("1250.50");
    await dialog.locator("#pay-client-name").fill(client);
    await dialog.getByRole("button", { name: "Save Record" }).click();

    // Analysts confirm first, since saved records are final for them.
    const confirm = page.getByRole("dialog", { name: "Add this payment record?" });
    await expect(confirm).toContainText(dmy(date));
    await expect(confirm).toContainText("Final Payment (AUD)");
    await expect(confirm).toContainText("1,250.50");
    await confirm.getByRole("button", { name: "Yes, add record" }).click();

    const row = page.getByRole("row").filter({ hasText: client });
    await expect(row).toBeVisible();
    await expect(row).toContainText(dmy(date));
    await expect(row).toContainText("Final Payment (AUD)");
    await expect(row).toContainText("1,250.50");
  });
});

test.describe("CT-13 Payment Record form (Main Team Lead)", () => {
  test.use({ storageState: USERS.mainTeamLead.file });

  test("can add and edit a record with the new fields", async ({ page }) => {
    const client = `E2E Lead ${Date.now()}`;
    const dialog = await openAddDialog(page);
    await fillDate(page, "pay-date", isoDaysAgo(1));
    await pick(dialog.getByRole("button", { name: "Payment Type" }), "Initial Payment (AUD)");
    await dialog.locator("#pay-amount").fill("300");
    await dialog.locator("#pay-client-name").fill(client);
    await dialog.locator("#pay-team").fill("E2E Team");
    await dialog.locator("#pay-profile").fill("E2E Profile");
    await dialog.locator("#pay-analyst").fill("E2E Analyst");
    await dialog.getByRole("button", { name: "Save Record" }).click();

    const row = page.getByRole("row").filter({ hasText: client });
    await expect(row).toContainText("Initial Payment (AUD)");
    await expect(row).toContainText("300.00");

    await row.getByRole("button", { name: /Edit payment record/ }).click();
    const edit = page.getByRole("dialog", { name: "Edit Payment Record" });
    await expect(edit.locator("#pay-amount")).toHaveValue("300.00");
    await pick(edit.getByRole("button", { name: "Payment Type" }), "Final Payment (AUD)");
    await edit.locator("#pay-amount").fill("450");
    await edit.getByRole("button", { name: "Save Changes" }).click();

    await expect(row).toContainText("Final Payment (AUD)");
    await expect(row).toContainText("450.00");
  });
});
