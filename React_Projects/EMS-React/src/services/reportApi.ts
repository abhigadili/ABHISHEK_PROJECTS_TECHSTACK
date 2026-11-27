import { http } from '@/api/httpClient';

/** Server-generated CSV (`?format=csv`) downloaded as a Blob. Path examples: `/reports/departments`, `/attendance/reports/monthly`. */
export async function downloadCsv(
  path: string,
  params: Record<string, string | number | undefined> = {},
): Promise<Blob> {
  const clean = Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== ''));
  const { data } = await http.get<Blob>(path, { params: { ...clean, format: 'csv' }, responseType: 'blob' });
  return data;
}

/** Trigger a browser download for a Blob without any unsafe HTML. */
export function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const reportApi = { downloadCsv, saveBlob };
