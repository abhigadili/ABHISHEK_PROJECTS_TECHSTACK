const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const { ROLES } = require('../constants');

router.use('/auth', require('./authRoutes'));
router.use(authenticate); // everything below requires a valid access token
router.use('/profile', require('./profileRoutes'));
router.use('/employees', require('./employeeRoutes'));
router.use('/org-chart', require('./orgRoutes'));
router.use('/attendance', require('./attendanceRoutes'));
router.use('/leave', require('./leaveRoutes'));
router.use('/notifications', require('./notificationRoutes'));
router.use('/audit-logs', authorize(ROLES.SUPER_ADMIN, ROLES.HR_ADMIN), require('./auditRoutes'));
router.use('/', require('./referenceRoutes')); // departments, teams, designations
router.use('/', require('./holidayRoutes')); // holidays, weekly-offs, calendar
router.use('/', require('./reportRoutes')); // dashboard, upcoming-events, reports
module.exports = router;
