const router = require('express').Router();
const { body, query } = require('express-validator');
const c = require('../controllers/notificationController');
const validate = require('../middleware/validate');
const { idParam, pageQuery } = require('../validators/common');

router.get('/', [...pageQuery, query('unread').optional().isBoolean().toBoolean()], validate, c.list);
router.get('/unread-count', c.unreadCount);
router.post('/read', [body('ids').optional().isArray({ max: 200 }), body('ids.*').isInt({ min: 1 }).toInt()], validate, c.markAllRead);
router.get('/:id', idParam(), validate, c.get);
router.post('/:id/read', idParam(), validate, c.markRead);
module.exports = router;
