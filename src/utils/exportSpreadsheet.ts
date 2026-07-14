import { format } from 'date-fns';

export type SpreadsheetColumn = {
  key: string;
  label: string;
};

type SpreadsheetMetaRow = string | { label: string; value: string };

type ExportSpreadsheetOptions<Row extends Record<string, any>> = {
  title: string;
  fileName: string;
  rows: Row[];
  columns?: SpreadsheetColumn[];
  meta?: SpreadsheetMetaRow[];
};

const humanizeLabel = (value: string) =>
  String(value || '')
    .replace(/_/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (match) => match.toUpperCase());

const isIsoDateString = (value: string) => {
  const raw = String(value || '').trim();
  if (!raw || !/^\d{4}-\d{2}-\d{2}/.test(raw)) return false;
  const parsed = new Date(raw);
  return !Number.isNaN(parsed.getTime());
};

const formatSpreadsheetValue = (value: unknown) => {
  if (value === null || value === undefined || value === '') return '';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return format(value, 'MMM dd, yyyy, h:mm a');
  }
  if (typeof value === 'string' && isIsoDateString(value)) {
    const parsed = new Date(value);
    const hasTime = /T|\d{2}:\d{2}/.test(value);
    return format(parsed, hasTime ? 'MMM dd, yyyy, h:mm a' : 'MMM dd, yyyy');
  }
  return String(value);
};

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const buildSpreadsheetContent = <Row extends Record<string, any>>({
  title,
  rows,
  columns,
  meta,
}: Omit<ExportSpreadsheetOptions<Row>, 'fileName'>): string => {
  const resolvedColumns: SpreadsheetColumn[] =
    columns && columns.length > 0
      ? columns
      : Array.from(
          rows.reduce((set, row) => {
            Object.keys(row || {}).forEach((key) => set.add(key));
            return set;
          }, new Set<string>()),
        ).map((key) => ({ key, label: humanizeLabel(key) }));

  const colspan = Math.max(resolvedColumns.length, 1);

  const metaRows = [
    `<tr><td colspan="${colspan}" style="font-size:16pt;font-weight:700;padding:12px 8px;text-align:left;">${escapeHtml(
      title,
    )}</td></tr>`,
    ...(meta || []).map((item) => {
      const value =
        typeof item === 'string' ? item : `${String(item.label || '').trim()}: ${String(item.value || '').trim()}`;
      return `<tr><td colspan="${colspan}" style="font-size:10pt;padding:4px 8px;text-align:left;">${escapeHtml(
        value,
      )}</td></tr>`;
    }),
  ].join('');

  const headerRow = `<tr>${resolvedColumns
    .map(
      (col) =>
        `<th style="background:#f3f4f6;font-weight:700;padding:8px;border:1px solid #d1d5db;text-align:left;">${escapeHtml(
          humanizeLabel(col.label || col.key),
        )}</th>`,
    )
    .join('')}</tr>`;

  const bodyRows = rows
    .map(
      (row) =>
        `<tr>${resolvedColumns
          .map((col) => {
            const rawValue = row?.[col.key];
            const value = escapeHtml(formatSpreadsheetValue(rawValue));
            return `<td style="padding:8px;border:1px solid #e5e7eb;text-align:left;mso-number-format:'\\@';">${value}</td>`;
          })
          .join('')}</tr>`,
    )
    .join('');

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(title)}</title>
  </head>
  <body>
    <table>
      ${metaRows}
      ${headerRow}
      ${bodyRows}
    </table>
  </body>
</html>`;
};

export const exportSpreadsheet = <Row extends Record<string, any>>(options: ExportSpreadsheetOptions<Row>) => {
  const spreadsheetContent = buildSpreadsheetContent(options);
  const blob = new Blob([`\ufeff${spreadsheetContent}`], { type: 'application/vnd.ms-excel;charset=utf-8;' });
  const link = document.createElement('a');
  if (link.download === undefined) return;
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', options.fileName);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
};

