import { expect, type Locator, type Page } from "@playwright/test";

/** Fill a CtDateInput (text box with YYYY-MM-DD) and commit it. */
export async function fillDate(page: Page, id: string, iso: string) {
  const input = page.locator(`#${id}`);
  await input.fill(iso);
  await input.press("Enter");
  await expect(input).toHaveValue(iso);
}

/** Pick an option in a CtSelect / LogTimeUnitSelect (button + listbox). */
export async function pick(trigger: Locator, option: string) {
  await trigger.click();
  await trigger.page().getByRole("option", { name: option, exact: true }).click();
}

/** Set a LogTimePicker by its aria-label prefix, e.g. "Client message received time". */
export async function setTime(page: Page, label: string, hour: string, minute: string, period: "AM" | "PM") {
  await pick(page.getByRole("button", { name: `${label} hour` }), hour);
  await pick(page.getByRole("button", { name: `${label} minute` }), minute);
  await page.getByRole("group", { name: `${label} AM or PM` }).getByRole("button", { name: period }).click();
}

export function isoDaysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  const p = (x: number) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function dmy(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d}/${m}/${y}`;
}
