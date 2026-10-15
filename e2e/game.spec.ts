import { Page, expect, test } from '@playwright/test';

async function startLesson(page: Page, title: string, seed = 7) {
  await page.goto(`/?seed=${seed}`);
  await page.evaluate(() => localStorage.clear());
  await page.goto(`/?seed=${seed}`);
  await page.getByRole('button', { name: new RegExp(title) }).click();
  await expect(page.getByRole('complementary', { name: 'Coach' })).toBeVisible();
}

/** Play passively (check/call) until `done` is true, failing if the table ever gets stuck. */
async function playUntil(page: Page, done: () => Promise<boolean>, maxActions = 120) {
  for (let i = 0; i < maxActions; i++) {
    if (await done()) return;
    const next = page.getByRole('button', { name: /Deal next hand/ });
    const check = page.getByRole('button', { name: /^Check/ });
    const call = page.getByRole('button', { name: /^Call/ });
    // whichever control appears first; if none appears within 8s the game is stuck
    await expect(next.or(check).or(call).first()).toBeVisible({ timeout: 8000 });
    if (await done()) return;
    if (await next.isVisible()) await next.click();
    else if (await check.isVisible()) await check.click();
    else await call.click();
  }
  throw new Error('Goal not reached within the action budget');
}

test('lesson 1 can be played to completion with a review at the end', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await startLesson(page, 'Your first hands');
  await expect(page.getByLabel('Community cards')).toBeVisible();
  await expect(page.getByText('Blinds start every pot')).toBeVisible();

  const review = page.getByRole('dialog', { name: /Your first hands/ });
  await playUntil(page, () => review.isVisible());
  await expect(review).toContainText('Hands');
  await expect(review.getByRole('button', { name: /Next: What beats what/ })).toBeVisible();
  expect(errors).toEqual([]);
});

test('hints escalate from nudge to show me and mark the suggested action', async ({ page }) => {
  await startLesson(page, 'Choosing starting hands', 11);
  const nudge = page.getByRole('button', { name: 'Nudge' });
  // wait for the player's turn
  await expect(nudge).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole('button', { name: 'Show me' })).toBeDisabled();
  await nudge.click();
  await page.getByRole('button', { name: 'Hint', exact: true }).click();
  await page.getByRole('button', { name: 'Show me' }).click();
  await expect(page.locator('.actionbar .is-suggested')).toHaveCount(1);
  await page.locator('.actionbar .is-suggested').click();
  await expect(page.getByText(/your last decision/)).toBeVisible();
});

test('hand history replays a finished hand', async ({ page }) => {
  await startLesson(page, 'Your first hands', 3);
  const next = page.getByRole('button', { name: /Deal next hand/ });
  await playUntil(page, () => next.isVisible());
  await page.getByRole('button', { name: /Hand history/ }).click();
  const drawer = page.getByRole('dialog', { name: 'Hand history' });
  await expect(drawer.getByText(/Hand 1/)).toBeVisible();
  await expect(drawer.getByText(/posts big blind/)).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(drawer).toBeHidden();
});

test('phone layout has no horizontal scroll and keeps actions reachable', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await startLesson(page, 'Choosing starting hands', 5);
  await expect(page.getByRole('button', { name: /^Fold|^Check/ }).first()).toBeVisible({ timeout: 15_000 });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await page.screenshot({ path: 'test-results/phone.png', fullPage: true });
});
