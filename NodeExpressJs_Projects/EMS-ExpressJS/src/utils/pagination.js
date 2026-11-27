function parsePagination(q, { defaultLimit = 20, maxLimit = 100 } = {}) {
  const page = Math.max(parseInt(q.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(q.limit, 10) || defaultLimit, 1), maxLimit);
  return { page, limit, offset: (page - 1) * limit };
}

/** Whitelist-based ORDER BY builder: never interpolates user input. */
function parseSort(q, allowed, fallback) {
  const raw = (q.sort || '').toString();
  const [field, dir] = raw.split(':');
  const col = allowed[field];
  if (!col) return fallback;
  return `${col} ${String(dir).toLowerCase() === 'desc' ? 'DESC' : 'ASC'}`;
}
module.exports = { parsePagination, parseSort };
