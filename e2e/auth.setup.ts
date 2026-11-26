import { expect, test as setup } from "@playwright/test";
import { USERS, seed } from "./seed";

setup("seed local db and sign in test users", async ({ browser }) => {
  await seed();
  for (const u of Object.values(USERS)) {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto("/login");
    await page.getByPlaceholder("you@company.com").fill(u.email);
    await page.getByPlaceholder("Password").fill(u.password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 30_000 });
    await ctx.storageState({ path: u.file });
    await ctx.close();
  }
});
