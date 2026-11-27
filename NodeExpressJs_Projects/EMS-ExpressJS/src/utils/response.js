const ok = (res, data, message = 'Success', status = 200, meta) => {
  const body = { success: true, message, data: data === undefined ? null : data };
  if (meta) body.meta = meta;
  return res.status(status).json(body);
};
const created = (res, data, message = 'Created successfully') => ok(res, data, message, 201);
const paged = (res, { items, page, limit, total }, message = 'Success') =>
  ok(res, items, message, 200, { page, limit, total, totalPages: Math.ceil(total / limit) || 0 });

module.exports = { ok, created, paged };
