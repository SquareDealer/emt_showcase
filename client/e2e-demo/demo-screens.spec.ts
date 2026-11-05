import { expect, test, type Page } from '@playwright/test';
import { HERO } from '../../demo/seed/hero';
import { mskAt } from '../../demo/seed/time';

/** The video's date, when neither DEMO_NOW nor the seeded settings.demo_now is at hand. */
const DEFAULT_DEMO_DAY = '2026-11-18';

/** DEMO_NOW, else settings.demo_now of the seeded base (with DATABASE_URL), else the video's date. */
async function demoDay(): Promise<string> {
  if (process.env.DEMO_NOW) return process.env.DEMO_NOW;
  if (!process.env.DATABASE_URL) return DEFAULT_DEMO_DAY;
  // pg lives in the repo root's node_modules (the backend's), reachable from client/e2e-demo.
  const { default: pg } = await import('pg');
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const { rows } = await client.query(`SELECT value FROM settings WHERE key = 'demo_now'`);
    return /^\d{4}-\d{2}-\d{2}$/.test(rows[0]?.value ?? '') ? rows[0].value : DEFAULT_DEMO_DAY;
  } finally {
    await client.end();
  }
}

let demoNow: Date;
test.beforeAll(async () => {
  demoNow = mskAt(await demoDay(), 12);
});
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
