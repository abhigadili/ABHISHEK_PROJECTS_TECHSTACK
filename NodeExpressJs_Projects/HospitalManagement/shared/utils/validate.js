/** Zod request validation: parsed values are placed on req.valid (Express 5 makes req.query read-only). */
export const validate = ({ body, query, params } = {}) => (req, res, next) => {
  try {
    req.valid = {
      body: body ? body.parse(req.body ?? {}) : req.body,
      query: query ? query.parse(req.query) : req.query,
      params: params ? params.parse(req.params) : req.params,
    };
    next();
  } catch (e) { next(e); }
};
