const router = require('express').Router();
const { query } = require('express-validator');
const validate = require('../middleware/validate');
const asyncHandler = require('../utils/asyncHandler');
const auditRepo = require('../repositories/auditRepository');
const { paged } = require('../utils/response');
const { parsePagination } = require('../utils/pagination');
const { pageQuery } = require('../validators/common');

router.get('/', [...pageQuery, query('entityType').optional().isString().isLength({ max: 40 }), query('entityId').optional().isString().isLength({ max: 40 }), query('userId').optional().isInt({ min: 1 }).toInt()], validate,
  asyncHandler(async (req, res) => {
    const p = parsePagination(req.query);
    const { items, total } = await auditRepo.list({ ...req.query, limit: p.limit, offset: p.offset });
    paged(res, { items, page: p.page, limit: p.limit, total }, 'Audit logs retrieved successfully');
  }));
module.exports = router;
