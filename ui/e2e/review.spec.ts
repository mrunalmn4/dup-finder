import { expect, test } from "@playwright/test";

const API = process.env.E2E_API || "http://127.0.0.1:7420";
const TOKEN = process.env.E2E_TOKEN || "dev-token-change-me";

test("review shows keep reason, BLAKE3 verify, no spoof thumbs", async ({ page }) => {
  await page.addInitScript(
    ({ api, token }) => {
      localStorage.setItem("dup.api", api);
      localStorage.setItem("dup.token", token);
      localStorage.setItem("dup.onboarding.v1", "1");
      localStorage.setItem("dup.setupMode.v1", "advanced");
      localStorage.removeItem("dup.session.v1");
    },
    { api: API, token: TOKEN },
  );

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Dup Finder" })).toBeVisible();

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

  await expect(page.getByText(/Identical content verified \(BLAKE3/i)).toBeVisible();
  await expect(page.getByText(/Suggested keep:/i).first()).toBeVisible();
  // Fixture duplicates are text (incl. spoofed .jpg) — no image thumbs / no broken icons
  await expect(page.locator("img.thumb")).toHaveCount(0);
});
