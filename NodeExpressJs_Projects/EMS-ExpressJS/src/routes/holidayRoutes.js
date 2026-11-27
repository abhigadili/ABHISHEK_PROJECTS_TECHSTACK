const router = require('express').Router();
const c = require('../controllers/holidayController');
const v = require('../validators/holidayValidators');
const validate = require('../middleware/validate');
const { authorize } = require('../middleware/auth');
const { ADMINS } = require('../constants');

router.get('/holidays', v.list, validate, c.list);
router.post('/holidays', authorize(ADMINS), v.create, validate, c.create);
router.put('/holidays/:id', authorize(ADMINS), v.update, validate, c.update);
router.delete('/holidays/:id', authorize(ADMINS), v.id, validate, c.remove);
router.get('/weekly-offs', c.weeklyOffs);
router.put('/weekly-offs', authorize(ADMINS), v.weeklyOffs, validate, c.setWeeklyOffs);
router.get('/calendar/leave', v.month, validate, c.leaveCalendar);
router.get('/calendar/attendance', v.month, validate, c.attendanceCalendar);
module.exports = router;
