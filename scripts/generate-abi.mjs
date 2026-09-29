#!/usr/bin/env node
/**
 * Generates the frontend ABI from the compiled Solidity artifact.
 *
 * The ABI is never hand-written. It is read from
 * `out/ZeroGLocker.sol/ZeroGLocker.json`, which is produced by `forge build`,
 * so the frontend can never drift from the deployed bytecode.
 *
 *   forge build && npm run abi
 */
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const ARTIFACT = resolve(root, 'out/ZeroGLocker.sol/ZeroGLocker.json');
const OUTPUT = resolve(root, 'src/abi/ZeroGLocker.ts');
const BYTECODE_OUTPUT = resolve(root, 'src/abi/ZeroGLocker.bytecode.ts');

/** Shape of the fields we actually consume from a Foundry artifact. */
const REQUIRED_ABI_KEYS = ['createLock', 'withdraw', 'getLock', 'getUserLockIds', 'getUserLockedBalance', 'getTotalLocked'];
const REQUIRED_EVENTS = ['LockCreated', 'LockWithdrawn'];

async function main() {
  if (!existsSync(ARTIFACT)) {
    console.error(`\nMissing compiled artifact at:\n  ${ARTIFACT}\n\nRun \`forge build\` first.\n`);
    process.exit(1);
  }

  const artifact = JSON.parse(await readFile(ARTIFACT, 'utf8'));
  const {abi} = artifact;

  // Newer Foundry versions nest the hex payload under `bytecode.object`.
  const bytecode = typeof artifact.bytecode === 'string' ? artifact.bytecode : artifact.bytecode?.object;

  if (!Array.isArray(abi) || abi.length === 0) {
    console.error('Artifact contains no ABI entries.');
    process.exit(1);
  }

  // Fail loudly rather than shipping a stale or partial ABI to the frontend.
  const functions = new Set(abi.filter((e) => e.type === 'function').map((e) => e.name));
  const events = new Set(abi.filter((e) => e.type === 'event').map((e) => e.name));

  const missing = [
    ...REQUIRED_ABI_KEYS.filter((fn) => !functions.has(fn)).map((fn) => `function ${fn}()`),
    ...REQUIRED_EVENTS.filter((ev) => !events.has(ev)).map((ev) => `event ${ev}`),
  ];
  if (missing.length > 0) {
    console.error(`Artifact is missing required entries:\n  ${missing.join('\n  ')}`);
    process.exit(1);
  }

  if (typeof bytecode !== 'string' || bytecode.length <= 2) {
    console.error('Artifact contains no deploy bytecode. Did `forge build` run with bytecode output enabled?');
    process.exit(1);
  }

  // A canonical, deterministic serialisation keeps the diff meaningful.
  const sorted = [...abi].sort((a, b) => {
    const key = (e) => `${e.type}:${e.name ?? ''}:${(e.inputs ?? []).map((i) => i.type).join(',')}`;
    return key(a).localeCompare(key(b));
  });

  const abiLiteral = JSON.stringify(sorted, null, 2)
    .split('\n')
    .map((line, index) => (index === 0 ? line : `  ${line}`))
    .join('\n');

  const banner = `// GENERATED FILE — DO NOT EDIT BY HAND.
// Regenerate with \`forge build && npm run abi\`.
// Source: contracts/ZeroGLocker.sol
`;

  await mkdir(dirname(OUTPUT), {recursive: true});

  await writeFile(
    OUTPUT,
    `${banner}
/**
 * ABI of \`ZeroGLocker\`, generated from the compiled Foundry artifact.
 * Kept as a literal so wagmi/viem get exact ABI types without runtime parsing.
 */
export const ZERO_G_LOCKER_ABI = ${abiLiteral} as const;

export type ZeroGLockerAbi = typeof ZERO_G_LOCKER_ABI;
`,
    'utf8',
  );

  await writeFile(
    BYTECODE_OUTPUT,
    `${banner}
/** Creation bytecode of \`ZeroGLocker\`, generated from the compiled Foundry artifact. */
export const ZERO_G_LOCKER_BYTECODE = '0x${bytecode}' as const;
`,
    'utf8',
  );

  const fnCount = functions.size;
  const evCount = events.size;
  const errCount = abi.filter((e) => e.type === 'error').length;
  console.log(`Wrote ${OUTPUT}`);
  console.log(`Wrote ${BYTECODE_OUTPUT}`);
  console.log(`  ${fnCount} functions, ${evCount} events, ${errCount} errors, ${(bytecode.length - 2) / 2} bytes of code`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
