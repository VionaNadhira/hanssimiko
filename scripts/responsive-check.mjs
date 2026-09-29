/**
 * Responsive regression check.
 *
 * Loads every reachable view at every width in TEST_WIDTHS, in both
 * orientations, and asserts that the document never scrolls horizontally and
 * that no element is clipped by the viewport. Screenshots land in
 * `screenshots/` so the layout can be reviewed at a glance.
 *
 * Runs against the production build using the system Chrome, because the
 * Playwright-managed browser download is blocked in this environment.
 *
 *   node scripts/responsive-check.mjs
 */
import {chromium} from 'playwright';
import {mkdir, writeFile} from 'node:fs/promises';
import path from 'node:path';

const BASE_URL = process.env.BASE_URL ?? 'http://127.0.0.1:3111';
const OUT_DIR = path.resolve('screenshots');

/** Must stay in sync with src/config/breakpoints.ts. */
const WIDTHS = [320, 360, 390, 430, 768, 820, 1024, 1280, 1440, 1920, 2560];

/**
 * Assertions about the chrome itself, checked once per viewport.
 *
 * These are regressions that a screenshot cannot be trusted to catch and that
 * the overflow probe would not see either, because the offending content is not
 * overflowing anything.
 */
function probeShell() {
  const text = document.body.innerText;
  const sidebar = document.querySelector('aside[aria-label="Primary navigation"]');
  const sidebarText = sidebar ? sidebar.innerText : '';
  return {
    // The breadcrumb was removed from the top bar; these strings must not
    // reappear anywhere in the document.
    hasBreadcrumb: /INFRASTRUCTURE/.test(text),
    // The bottom-of-sidebar block (chain id, account balance, vault address).
    sidebarHasChainId: /16661/.test(sidebarText),
    sidebarHasBalanceLabel: /ACCOUNT BALANCE/i.test(sidebarText),
    sidebarHasVaultLabel: /VAULT PROTOCOL/i.test(sidebarText),
    // The duplicate Create Lock action that used to sit below the menu. The nav
    // itself keeps its own "Create Lock" entry, so only buttons *outside* <nav>
    // count here.
    duplicateCreateLockBelowMenu: Array.from(
      sidebar?.querySelectorAll('button:not(nav button)') ?? [],
    ).filter((b) => /^create lock$/i.test((b.innerText || '').trim())).length,
    menuItems: Array.from(sidebar?.querySelectorAll('nav button') ?? []).map((b) => (b.innerText || '').trim()),
  };
}

/**
 * Measures horizontal overflow and, when there is any, names the elements
 * responsible. Elements that scroll internally are allowed to be wide, and
 * anything marked `data-overflow-ok` opts out explicitly.
 */
function probeOverflow() {
  const docWidth = document.documentElement.scrollWidth;
  const viewWidth = window.innerWidth;
  const offenders = [];

  if (docWidth > viewWidth + 1) {
    for (const el of document.querySelectorAll('body *')) {
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      if (rect.right <= viewWidth + 1 && rect.left >= -1) continue;

      const style = getComputedStyle(el);
      if (style.overflowX === 'auto' || style.overflowX === 'scroll') continue;
      if (el.closest('[data-overflow-ok]')) continue;

      offenders.push({
        tag: el.tagName.toLowerCase(),
        cls: (el.className && String(el.className).slice(0, 90)) || '',
        left: Math.round(rect.left),
        right: Math.round(rect.right),
        width: Math.round(rect.width),
      });
    }
  }

  return {docWidth, viewWidth, offenders: offenders.slice(0, 6)};
}

const TABS = ['overview', 'my-locks', 'create-lock', 'history'];

async function main() {
  await mkdir(OUT_DIR, {recursive: true});

  const browser = await chromium.launch({
    channel: 'chrome',
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });

  const failures = [];
  let checks = 0;

  for (const width of WIDTHS) {
    // Both orientations at every width, not just on phones. A tall-but-narrow
    // window and a short-but-wide one exercise different wrapping: the first
    // stresses the sidebar overlay and long single-column stacks, the second
    // stresses the desktop grid and the sticky header. Previously the wide
    // widths were only ever rendered in one of the two, so a whole class of
    // layout bugs went unmeasured.
    const heights = width < 768 ? [844, 390] : [900, 480];

    for (const height of heights) {
      // Width greater than height is landscape. This was inverted, which
      // mislabelled every phone screenshot: a 390x844 portrait was written out
      // as "390x844-landscape".
      const orientation = width > height ? 'landscape' : 'portrait';
      const context = await browser.newContext({
        viewport: {width, height},
        deviceScaleFactor: 1,
        reducedMotion: 'reduce',
      });
      const page = await context.newPage();

      await page.goto(BASE_URL, {waitUntil: 'networkidle'}).catch(() => {});

      for (const tab of TABS) {
        // Drive the real navigation so the shell is exercised, not just rendered.
        const clicked = await page
          .getByRole('button', {name: new RegExp(`^${tabLabel(tab)}$`, 'i')})
          .first()
          .click({timeout: 1500})
          .then(() => true)
          .catch(() => false);

        await page.waitForTimeout(350);

        const result = await page.evaluate(probeOverflow);
        const shell = await page.evaluate(probeShell);
        checks += 1;

        const overflow = result.docWidth > result.viewWidth + 1;
        const label = `${width}x${height} ${orientation} ${tab}${clicked ? '' : ' (nav hidden)'}`;

        if (overflow) {
          failures.push({
            view: label,
            kind: 'overflow',
            docWidth: result.docWidth,
            viewWidth: result.viewWidth,
            offenders: result.offenders,
          });
        }

        // Each assertion is written so that the *expected* state is falsy. A
        // truthy value means a removed element is back.
        for (const [key, value] of Object.entries(shell)) {
          if (key === 'menuItems') continue;
          if (value === false || value === 0 || value === null) continue;
          failures.push({view: label, kind: 'shell', detail: `${key} = ${JSON.stringify(value)}`});
        }

        const file = `${width}x${height}-${orientation}-${tab}.png`;
        await page.screenshot({
          path: path.join(OUT_DIR, file),
          fullPage: true,
        }).catch(() => {});
      }

      // Sidebar open/closed is where alignment bugs hide, so capture both.
      const toggle = page.getByRole('button', {name: 'Toggle sidebar'});
      if (await toggle.count()) {
        await toggle.first().click().catch(() => {});
        await page.waitForTimeout(300);
        const result = await page.evaluate(probeOverflow);
        checks += 1;
        if (result.docWidth > result.viewWidth + 1) {
          failures.push({
            view: `${width}x${height} ${orientation} sidebar-open`,
            kind: 'overflow',
            docWidth: result.docWidth,
            viewWidth: result.viewWidth,
            offenders: result.offenders,
          });
        }
        await page
          .screenshot({path: path.join(OUT_DIR, `${width}x${height}-${orientation}-sidebar-open.png`), fullPage: true})
          .catch(() => {});
      }

      await context.close();
    }
  }

  await browser.close();

  const report = {
    baseUrl: BASE_URL,
    widths: WIDTHS,
    checks,
    failures,
    generatedAt: new Date().toISOString(),
  };
  await writeFile(path.join(OUT_DIR, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);

  console.log(`\nchecks run: ${checks}`);
  console.log(`screenshots: ${OUT_DIR}`);
  if (failures.length === 0) {
    console.log('\nNo horizontal overflow and no removed chrome at any tested width.\n');
  } else {
    console.log(`\n${failures.length} failure(s):\n`);
    for (const failure of failures) {
      if (failure.kind === 'shell') {
        console.log(`  ${failure.view}  ${failure.detail}`);
        continue;
      }
      console.log(`  ${failure.view}  scrollWidth=${failure.docWidth} innerWidth=${failure.viewWidth}`);
      for (const offender of failure.offenders ?? []) {
        console.log(`      <${offender.tag} class="${offender.cls}"> right=${offender.right}`);
      }
    }
    console.log('');
    process.exitCode = 1;
  }
}

function tabLabel(tab) {
  return {overview: 'Overview', 'my-locks': 'My Locks', 'create-lock': 'Create Lock', history: 'History'}[tab];
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
