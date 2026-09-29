/**
 * Deep-link regression check for the vault detail panel.
 *
 * A shared `?vault=<id>` link has to land on My Locks even from a cold load,
 * because the selection hook is not mounted until that tab renders. Without the
 * tab switch the panel silently never opens.
 */
import {chromium} from 'playwright';

const BASE_URL = process.env.BASE_URL ?? 'http://127.0.0.1:3111';

const browser = await chromium.launch({channel: 'chrome'});
const page = await browser.newPage({viewport: {width: 1440, height: 900}});

const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
});

async function activeTab(url) {
  await page.goto(`${BASE_URL}${url}`, {waitUntil: 'networkidle'});
  await page.waitForTimeout(1200);
  // The sidebar marks the current destination with aria-current.
  const current = await page.$$eval('[aria-current="page"]', (nodes) =>
    nodes.map((n) => n.textContent?.trim()),
  );
  return current;
}

const failures = [];

const withVault = await activeTab('/?vault=3');
if (!withVault.includes('My Locks')) {
  failures.push(`?vault=3 did not open My Locks (aria-current: ${JSON.stringify(withVault)})`);
}

const plain = await activeTab('/');
if (!plain.includes('Overview')) {
  failures.push(`plain load did not open Overview (aria-current: ${JSON.stringify(plain)})`);
}

const hydration = errors.filter((e) => /hydrat|did not match|Minified React error #(418|423|425)/i.test(e));
if (hydration.length > 0) failures.push(`hydration errors: ${hydration.join(' | ')}`);

await browser.close();

if (failures.length > 0) {
  console.error('deep-link check FAILED');
  for (const f of failures) console.error(` - ${f}`);
  process.exit(1);
}
console.log('deep-link check passed: ?vault=3 -> My Locks, / -> Overview, no hydration mismatch');
