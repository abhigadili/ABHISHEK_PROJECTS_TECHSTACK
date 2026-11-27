export const money = (n: number | string | null | undefined, symbol = '$') => `${symbol}${Number(n ?? 0).toFixed(2)}`;
export const fmtDate = (v?: string | null) => {
  if (!v) return '—';
  const d = new Date(v.length === 10 ? `${v}T00:00:00Z` : v);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric', timeZone: v.length === 10 ? 'UTC' : undefined });
};
export const fmtDateTime = (v?: string | null) => {
  if (!v) return '—';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};
export const todayISO = () => new Date().toISOString().slice(0, 10);
export const titleCase = (s: string) => s.replace(/[_-]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
export const timeAgo = (v: string) => {
  const s = Math.max(1, Math.round((Date.now() - new Date(v).getTime()) / 1000));
  if (s < 60) return 'just now'; if (s < 3600) return `${Math.floor(s / 60)}m ago`; if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};

export const tomorrowISO = () => new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
