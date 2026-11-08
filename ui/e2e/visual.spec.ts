import { expect, test, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const API = process.env.E2E_API || "http://127.0.0.1:7420";
const TOKEN = process.env.E2E_TOKEN || "dev-token-change-me";
const OUT = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../artifacts/e2e-shots",
);
fs.mkdirSync(OUT, { recursive: true });

async function prep(page: Page, theme: "light" | "dark") {
  await page.addInitScript(
    ({ api, token, theme }) => {
      localStorage.setItem("dup.api", api);
      localStorage.setItem("dup.token", token);
      localStorage.setItem("dup.onboarding.v1", "1");
      localStorage.setItem("dup.setupMode.v1", "advanced");
      localStorage.setItem("dup.theme.v1", theme);
      localStorage.setItem("dup.density.v1", "comfortable");
      localStorage.removeItem("dup.session.v1");
    },
    { api: API, token: TOKEN, theme },
  );
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Dup Finder" })).toBeVisible();
}

async function scanToReview(page: Page) {
  const sample = page.getByRole("button", { name: /Sample files/i });
  if (await sample.isVisible().catch(() => false)) {
    await sample.click();
  } else {
    await page.getByRole("button", { name: /Add folder by typing/i }).click();
    await page.getByLabel("Folder path").fill("/app/docker/fixtures");
    await page.getByRole("button", { name: "Add path" }).click();
  }
  await page.getByRole("button", { name: /^Scan/i }).click();
  await expect(page.getByRole("heading", { name: "Duplicates" })).toBeVisible({
    timeout: 90_000,
  });
}

for (const theme of ["light", "dark"] as const) {
  test(`visual ${theme}: Help + Review + Confirm`, async ({ page }) => {
    await prep(page, theme);
    await page.getByRole("button", { name: "Help" }).click();
    await expect(page.getByRole("heading", { name: "Help & guides" })).toBeVisible();
    await page.screenshot({
      path: path.join(OUT, `${theme}-help.png`),
      fullPage: true,
    });
    await page.getByRole("button", { name: "Close" }).click();

    await scanToReview(page);
    await expect(page.getByText(/Keep rule/i)).toBeVisible();
    await page.screenshot({
      path: path.join(OUT, `${theme}-review.png`),
      fullPage: true,
    });

    await page.getByRole("button", { name: "Select all reclaimable" }).click();
    await page.getByRole("button", { name: /Preview delete/i }).click();
    await expect(page.getByRole("heading", { name: "Confirm remove" })).toBeVisible({
      timeout: 60_000,
    });
    await page.screenshot({
      path: path.join(OUT, `${theme}-confirm.png`),
      fullPage: true,
    });
  });
}
