/**
 * CSV export for the audit ledger.
 *
 * Values are quoted and internal quotes doubled, so a value containing a comma,
 * a quote or a newline cannot break the row. Every row carries the explorer URL
 * so a downloaded file is verifiable without leaving the file.
 */
import {EXPLORER_URL} from '@/config/chain';
import type {LedgerRow} from '@/hooks/useLedger';

const COLUMNS = [
  'tx_hash',
  'block_number',
  'event_type',
  'vault_id',
  'amount',
  'unlock_date',
  'timestamp',
  'explorer_url',
] as const;

/** RFC 4180 field escaping. */
function escapeCsv(value: string | number): string {
  const text = String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function isoDate(seconds: bigint): string {
  return new Date(Number(seconds) * 1000).toISOString();
}

export function ledgerToCsv(rows: LedgerRow[]): string {
  const lines = [COLUMNS.join(',')];

  for (const row of rows) {
    lines.push(
      [
        row.transactionHash,
        row.blockNumber.toString(),
        row.kind,
        row.lockId.toString(),
        row.amount.toString(),
        isoDate(row.unlockTime),
        row.timestamp === null ? '' : isoDate(row.timestamp),
        `${EXPLORER_URL}/tx/${row.transactionHash}`,
      ]
        .map(escapeCsv)
        .join(','),
    );
  }

  // Trailing newline: some spreadsheet importers drop the final row without it.
  return `${lines.join('\r\n')}\r\n`;
}

/** `hanssimiko-bunker-history-<short address>-<date>.csv` */
export function ledgerFileName(address: string | undefined): string {
  const short = address ? `${address.slice(0, 8)}-${address.slice(-6)}` : 'unknown';
  const date = new Date().toISOString().slice(0, 10);
  return `hanssimiko-bunker-history-${short}-${date}.csv`;
}

export function downloadCsv(filename: string, csv: string) {
  // The BOM makes Excel read the file as UTF-8 instead of the local codepage.
  const blob = new Blob(['﻿', csv], {type: 'text/csv;charset=utf-8;'});
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
