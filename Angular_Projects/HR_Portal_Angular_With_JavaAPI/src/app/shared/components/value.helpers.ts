export const hasContent = (v: unknown) => Array.isArray(v) ? v.length > 0 : v != null;
