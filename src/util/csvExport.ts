/** RFC 4180-style escaping for CSV cells */
export function escapeCsvCell(val: unknown): string {
    const s = val == null ? '' : String(val);
    if (/[",\n\r]/.test(s)) {
        return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
}

export function buildCsvWithBom(rows: string[][]): string {
    const lines = rows.map((cells) => cells.map(escapeCsvCell).join(','));
    return '\uFEFF' + lines.join('\n');
}
