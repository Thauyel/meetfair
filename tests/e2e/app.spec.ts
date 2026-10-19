import { expect, test, type Page } from "@playwright/test";

// The server runs with MOCK_PROVIDERS=1: geocoding returns "<query> 1..3" near Taksim, routing is synthetic.

async function placePerson(page: Page, n: number, query: string, pick: number) {
  const input = page.getByRole("combobox", { name: `Starting point for Person ${n}` });
  await input.fill(query);
  await page.getByRole("option", { name: new RegExp(`${query} ${pick}`) }).click();
  await expect(input).toHaveValue(`${query} ${pick}`);
}

test("three people with mixed modes find ranked places, and the shared link reproduces them", async ({ page, context }) => {
  await page.goto("/en");
  await page.getByRole("button", { name: "Add person" }).click();

  await placePerson(page, 1, "Home", 1);
  await placePerson(page, 2, "Work", 2);
  await placePerson(page, 3, "Gym", 3);

  const cards = page.locator("li[id^=venue-]");
  const modes = page.getByRole("group", { name: "Travel by" });
  await modes.nth(0).getByRole("button", { name: "Walk" }).click();
  await modes.nth(1).getByRole("button", { name: "Car" }).click();
  // Person 3 keeps the default: transit.

  await page.getByRole("button", { name: "Find a fair place" }).click();
  await expect(page.getByRole("heading", { name: "Best places" })).toBeVisible();
  await expect(cards.first()).toBeVisible();
  const first = await cards.first().getByRole("button").first().innerText();

  // Re-sorting is local and keeps the list.
  await page.getByRole("tab", { name: "Most equal" }).click();
  await expect(cards.first()).toBeVisible();
  await page.getByRole("tab", { name: "Shortest longest trip" }).click();

  const url = page.url();
  expect(url).toContain("walk");
  expect(url).toContain("car");

  const shared = await context.newPage();
  await shared.goto(url);
  await expect(shared.locator("li[id^=venue-]").first().getByRole("button").first()).toHaveText(first);
});

test("search needs everyone's starting point", async ({ page }) => {
  await page.goto("/en");
  await expect(page.getByRole("button", { name: "Find a fair place" })).toBeDisabled();
  await expect(page.getByText("Add a starting point for everyone")).toBeVisible();
});

test("pasted coordinates place a person", async ({ page }) => {
  await page.goto("/en");
  const input = page.getByRole("combobox", { name: "Starting point for Person 1" });
  await input.fill("41.0369, 28.985");
  await expect(input).toHaveValue("41.037, 28.985");
});

test("Arabic renders right-to-left and translated", async ({ page }) => {
  await page.goto("/ar");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.getByRole("button", { name: "ابحث عن مكان عادل" })).toBeVisible();
});

test("follows the system dark theme", async ({ browser }) => {
  const context = await browser.newContext({ colorScheme: "dark" });
  const page = await context.newPage();
  await page.goto("/en");
  await expect(page.locator("html")).toHaveClass(/dark/);
  await context.close();
});
