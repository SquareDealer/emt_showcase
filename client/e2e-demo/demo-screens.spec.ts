import { expect, test, type Page } from '@playwright/test';
import { HERO } from '../../demo/seed/hero';
import { mskAt } from '../../demo/seed/time';

const demoNow = mskAt(process.env.DEMO_NOW ?? '2026-11-04', 12);
let errors: string[] = [];
test.beforeEach(async ({ page }) => {
  errors = [];
  await page.clock.setFixedTime(demoNow);
  page.on('pageerror', (e) => errors.push(e.message));
  // favicon.ico is not shipped by the client: the 404 is noise, not a demo defect.
  page.on('console', (m) => m.type() === 'error' && !m.location().url.endsWith('/favicon.ico') && errors.push(`${m.text()} ${m.location().url}`));
  await page.goto('/login');
  await page.fill('#login', HERO.logins.owner);
  await page.fill('#pw', process.env.DEMO_PASSWORD!);
  await page.getByRole('button').click();
  await page.waitForURL('**/clients');
});
test.afterEach(() => expect(errors).toEqual([]));

const shots: [string, string, (p: Page) => Promise<void>][] = [
  ['board', '/board', async (p) => expect(p.getByText('В работе').first()).toBeVisible()],
  ['calendar', '/calendar', async (p) => expect(p.locator('[data-demo="timeline-event"]').first()).toBeVisible()],
  ['archive', '/archive', async (p) => expect(p.locator('.list-row.archive-row').nth(5)).toBeVisible()],
  ['client', `/clients/${HERO.client.id}`, async (p) => expect(p.getByText(HERO.client.name).first()).toBeVisible()],
  ['price-list', '/price-list', async (p) => expect(p.getByText('Замена цепи ГРМ (R56/N14)').first()).toBeVisible()],
  ['hero-order', `/work-orders/${HERO.bigOrder.id}`, async (p) => {
    // The first text match is a hidden <option> of the template picker; wait for a priced row instead.
    await expect(p.getByRole('heading', { name: 'Работы' })).toBeVisible();
    await expect(p.getByText('Замена передних тормозных дисков и колодок', { exact: false }).locator('visible=true').first()).toBeVisible();
  }],
];
for (const [name, url, check] of shots) {
  test(name, async ({ page }) => {
    await page.goto(url);
    await check(page);
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: `../demo/out/screens/${name}.png`, fullPage: false });
  });
}
