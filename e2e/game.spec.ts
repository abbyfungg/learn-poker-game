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
    const bar = page.locator('.actionbar');
    const next = bar.getByRole('button', { name: /Deal next hand/ });
    const check = bar.getByRole('button', { name: /^Check/ });
    const call = bar.getByRole('button', { name: /^Call/ });
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
  const next = page.locator('.actionbar').getByRole('button', { name: /Deal next hand/ });
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
  await expect(page.locator('.actionbar').getByRole('button', { name: /^Fold|^Check/ }).first()).toBeVisible({ timeout: 15_000 });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  // smallest common phones (320px) must not overflow either
  await page.setViewportSize({ width: 320, height: 640 });
  const narrow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(narrow).toBeLessThanOrEqual(0);
  await page.screenshot({ path: 'test-results/phone.png', fullPage: true });
});

test('hand badge opens the hand guide with ratings, rankings and words', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await startLesson(page, 'Your first hands', 8);
  const badge = page.locator('.handbadge');
  await expect(badge).toContainText(/Weak|Marginal|Decent|Strong|Very strong/);
  await badge.click();
  const guide = page.getByRole('dialog', { name: 'Hand guide' });
  await expect(guide.locator('.guide__points li').first()).toBeVisible();
  await expect(guide).toContainText(/Better than about \d+% of all possible starting hands/);
  await page.screenshot({ path: 'test-results/guide-mine.png' });
  await guide.getByRole('tab', { name: 'What beats what' }).click();
  await expect(guide.locator('.ranklist li')).toHaveCount(9);
  await page.screenshot({ path: 'test-results/guide-rankings.png' });
  await guide.getByRole('tab', { name: 'Starting hands' }).click();
  await expect(guide.locator('.tierlist li.is-current')).toHaveCount(1);
  await page.screenshot({ path: 'test-results/guide-starting.png' });
  await guide.getByRole('tab', { name: 'Poker words' }).click();
  await expect(guide).toContainText('Kicker');
  await page.keyboard.press('Escape');
  await expect(guide).toBeHidden();
  // the G shortcut toggles it too
  await page.keyboard.press('g');
  await expect(guide).toBeVisible();
});

test('jargon in coach notes explains itself on hover and tap', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await startLesson(page, 'Your first hands', 8);
  const term = page.locator('.coach .term', { hasText: /^big blind$/i }).first();
  await term.hover();
  const tip = page.getByRole('tooltip');
  await expect(tip).toBeVisible();
  await expect(tip).toContainText('forced full-size bet');
  const box = await tip.boundingBox();
  expect(box && box.width > 100 && box.y >= 0).toBeTruthy();
  await page.screenshot({ path: 'test-results/tooltip.png' });
  await page.mouse.move(5, 5);
  await expect(tip).toBeHidden();
  // position tags on the table explain themselves too
  await page.locator('.seat__pos .term').first().hover();
  await expect(page.getByRole('tooltip')).toBeVisible();
});

test('the coach narrates the hand as it happens', async ({ page }) => {
  await startLesson(page, 'Your first hands', 8);
  const pbp = page.getByLabel("What's happening");
  await expect(pbp).toContainText('posted the small blind');
  await expect(pbp).toContainText(/Your turn/);
});
