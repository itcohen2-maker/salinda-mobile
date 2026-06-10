// ============================================================
// reportExport.ts — Build CSV from report datasets and deliver it.
//
// On web (the primary platform, Vercel) we generate a real file download
// using standard browser APIs (Blob + object URL + <a download>) — no native
// packages required (native modules break Expo Go; see project memory).
// On native we fall back to copying the CSV to the clipboard.
// ============================================================

import { Platform } from 'react-native';
import * as Clipboard from 'expo-clipboard';

export type CsvRow = Record<string, unknown>;

/** Escape a single CSV cell per RFC 4180 (quote when needed, double inner quotes). */
function escapeCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Convert an array of flat objects into a CSV string.
 * Column order follows `columns` if given, otherwise the keys of the first row.
 */
export function rowsToCsv(rows: CsvRow[], columns?: string[]): string {
  if (rows.length === 0) return '';
  const cols = columns ?? Object.keys(rows[0]);
  const header = cols.map(escapeCell).join(',');
  const body = rows
    .map((row) => cols.map((col) => escapeCell(row[col])).join(','))
    .join('\r\n');
  return `${header}\r\n${body}`;
}

/**
 * Combine several named datasets into one CSV document, each preceded by a
 * `# section` marker so the whole report opens as a single spreadsheet file.
 */
export function buildReportCsv(
  sections: Array<{ title: string; rows: CsvRow[]; columns?: string[] }>,
): string {
  return sections
    .map(({ title, rows, columns }) => {
      const table = rows.length ? rowsToCsv(rows, columns) : '(empty)';
      return `# ${title}\r\n${table}`;
    })
    .join('\r\n\r\n');
}

export type DownloadResult = 'downloaded' | 'copied' | 'failed';

/**
 * Deliver `content` to the user. Web → file download; native → clipboard copy.
 * Returns how it was delivered so the caller can show the right toast.
 */
export async function downloadTextFile(
  filename: string,
  content: string,
  mimeType = 'text/csv;charset=utf-8',
): Promise<DownloadResult> {
  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    try {
      // Prepend a UTF-8 BOM so Excel renders Hebrew correctly.
      const blob = new Blob(['﻿', content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      return 'downloaded';
    } catch {
      // fall through to clipboard
    }
  }

  try {
    await Clipboard.setStringAsync(content);
    return 'copied';
  } catch {
    return 'failed';
  }
}

/** Timestamped report filename, e.g. salinda-report-2026-06-10T13-05-22.csv */
export function reportFilename(now: Date, ext = 'csv'): string {
  const iso = now.toISOString().slice(0, 19).replace(/:/g, '-');
  return `salinda-report-${iso}.${ext}`;
}
