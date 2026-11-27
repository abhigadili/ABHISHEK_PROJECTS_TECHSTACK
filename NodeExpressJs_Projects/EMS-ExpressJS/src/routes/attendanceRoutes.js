const router = require('express').Router();
const c = require('../controllers/attendanceController');
const v = require('../validators/attendanceValidators');
const validate = require('../middleware/validate');
const { authorize } = require('../middleware/auth');
const { ADMINS, MANAGERS_UP } = require('../constants');

router.post('/check-in', v.checkIn, validate, c.checkIn);
router.post('/check-out', v.checkOut, validate, c.checkOut);
router.get('/me', v.list, validate, c.mine);
router.get('/summary', v.summary, validate, c.summary);
router.get('/reports/monthly', authorize(MANAGERS_UP), v.monthly, validate, c.monthly);
router.get('/reports/department', authorize(ADMINS), v.department, validate, c.department);
router.get('/', v.list, validate, c.list);
router.post('/', authorize(ADMINS), v.manual, validate, c.manual);
router.get('/:id', v.id, validate, c.get);
router.put('/:id', authorize(ADMINS), v.correct, validate, c.correct);
module.exports = router;
