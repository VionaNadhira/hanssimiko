/**
 * Header/toggle placement check.
 *
 * Verifies the two rules that a screenshot cannot prove:
 *   1. the toggle lives in the sidebar header row on md+, and in the top bar
 *      on phones;
 *   2. the rule under the sidebar header and the rule under the top bar are
 *      the same y, so they read as one line across the window.
 */
import {chromium} from 'playwright';

const BASE_URL = process.env.BASE_URL ?? 'http://127.0.0.1:3111';
const WIDTHS = [360, 768, 1024, 1440];

const browser = await chromium.launch({channel: 'chrome'});
const failures = [];

for (const width of WIDTHS) {
  const page = await browser.newPage({viewport: {width, height: 900}});
  await page.goto(`${BASE_URL}/`, {waitUntil: 'networkidle'});
  await page.waitForTimeout(2000);

  const r = await page.evaluate(() => {
    const box = (el) => {
      if (!el) return null;
      const b = el.getBoundingClientRect();
      return {x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height), right: Math.round(b.right)};
    };
    const aside = document.querySelector('aside[aria-label="Primary navigation"]');
    const topbar = document.querySelector('header');
    const toggles = [...document.querySelectorAll('button[aria-label="Toggle sidebar"]')].filter(
      (b) => b.getBoundingClientRect().width > 0,
    );
    const toggle = toggles[0] ?? null;
    // The element that vertically contains the toggle decides "which row".
    const owner = toggle
      ? toggle.closest('aside') || toggle.closest('header')
      : null;
    const row = owner === aside ? aside.querySelector(':scope > div') : topbar?.querySelector('div');
    const rowStyle = row ? getComputedStyle(row) : null;
    return {
      toggleInSidebar: owner === aside,
      toggleInTopbar: owner === topbar,
      toggleCount: toggles.length,
      toggle: box(toggle),
      row: box(row),
      rowHeight: rowStyle ? Math.round(parseFloat(rowStyle.height)) : null,
      asideWidth: box(aside)?.w ?? null,
      // Anything floating over the content column on desktop is the old bug.
      floating: [...document.querySelectorAll('header button')].filter(
        (b) => getComputedStyle(b).display !== 'none' && b.getBoundingClientRect().width > 0,
      ).length,
      networkChipHasImg: !![...document.querySelectorAll('header img')].find((i) =>
        /0g-icon/.test(i.getAttribute('src') || ''),
      ),
    };
  });

  const desktop = width >= 768;
  const label = `${width}px`;

  if (r.toggleCount !== 1) failures.push(`${label}: expected 1 visible toggle, found ${r.toggleCount}`);
  if (desktop && !r.toggleInSidebar) failures.push(`${label}: toggle is not in the sidebar header row`);
  if (!desktop && !r.toggleInTopbar) failures.push(`${label}: toggle is not in the top bar`);
  if (r.rowHeight !== 72) failures.push(`${label}: header row height is ${r.rowHeight}px, expected 72px`);

  // Alignment: the sidebar header rule and the top bar rule share a y.
  const aligned = await page.evaluate(() => {
    const aside = document.querySelector('aside[aria-label="Primary navigation"]');
    const head = aside?.querySelector(':scope > div');
    const top = document.querySelector('header');
    if (!head || !top) return null;
    const hr = head.getBoundingClientRect().bottom;
    const tr = top.getBoundingClientRect().bottom;
    return {sidebarRule: Math.round(hr), topbarRule: Math.round(tr)};
  });
  // "One straight line" means the same pixel, not "close enough".
  if (aligned && Math.abs(aligned.sidebarRule - aligned.topbarRule) > 0) {
    failures.push(`${label}: rules misaligned sidebar=${aligned.sidebarRule} topbar=${aligned.topbarRule}`);
  }

  // Rail: the toggle must not be clipped by the 64px rail.
  if (desktop && r.asideWidth === 64 && r.toggle) {
    if (r.toggle.x < 0 || r.toggle.right > 64) {
      failures.push(`${label}: toggle clipped in rail (x=${r.toggle.x} right=${r.toggle.right})`);
    }
    if (r.toggle.w > 40) failures.push(`${label}: toggle ${r.toggle.w}px wide inside a 64px rail`);
  }

  if (r.networkChipHasImg) failures.push(`${label}: 0G logo still in the header network chip`);

  // Collapsing and re-opening must both work at every desktop width: the
  // worst failure mode is a rail the user cannot get out of.
  if (desktop) {
    const read = () =>
      page.evaluate(() => {
        const a = document.querySelector('aside[aria-label="Primary navigation"]');
        const t = document.querySelector('aside button[aria-label="Toggle sidebar"]');
        return {
          width: Math.round(a.getBoundingClientRect().width),
          expanded: t?.getAttribute('aria-expanded'),
          title: t?.getAttribute('title'),
        };
      });

    const toggle = page.locator('aside button[aria-label="Toggle sidebar"]').first();
    const start = await read();
    if (start.width === 64) {
      // Starts as a rail: one click must open it.
      await toggle.click();
      await page.waitForTimeout(700);
      const opened = await read();
      if (opened.width === 64) failures.push(`${label}: could not re-open the sidebar from the rail`);
      if (opened.title !== 'Collapse sidebar') failures.push(`${label}: tooltip is "${opened.title}" after opening`);
      await toggle.click();
      await page.waitForTimeout(700);
      const reclosed = await read();
      if (reclosed.width !== 64) failures.push(`${label}: could not collapse again from the panel`);
    } else {
      // Starts expanded: collapse to the rail, then recover.
      await toggle.click();
      await page.waitForTimeout(700);
      const collapsed = await read();
      if (collapsed.width !== 64) failures.push(`${label}: collapse from panel left width ${collapsed.width}`);
      if (collapsed.title !== 'Expand sidebar') failures.push(`${label}: tooltip is "${collapsed.title}" when collapsed`);
      await toggle.click();
      await page.waitForTimeout(700);
      const reopened = await read();
      if (reopened.width === 64) failures.push(`${label}: could not re-open the sidebar from the rail`);
    }
  }

  console.log(
    `${label.padStart(5)}  row=${r.rowHeight}px  aside=${r.asideWidth}  owner=${r.toggleInSidebar ? 'sidebar' : 'topbar'}  rule=${aligned ? `${aligned.sidebarRule}/${aligned.topbarRule}` : 'n/a'}`,
  );
  await page.close();
}

await browser.close();

if (failures.length) {
  console.error('\nFAILED');
  for (const f of failures) console.error(` - ${f}`);
  process.exit(1);
}
console.log('\nheader check passed: toggle placement, 72px rows, aligned rules, rail not clipped');
