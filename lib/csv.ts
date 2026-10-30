/** Builds a CSV (RFC 4180) with a UTF-8 BOM so spreadsheets detect accents. */
export function toCsv(header: string[], rows: (string | null | undefined)[][]) {
  const escape = (value: string | null | undefined) => {
    const text = value ?? "";

    return /[",\n\r;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };

  return `﻿${[header, ...rows].map((row) => row.map(escape).join(",")).join("\r\n")}`;
}

/** Triggers a browser download of a text file. Client-side only. */
export function downloadFile(filename: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
