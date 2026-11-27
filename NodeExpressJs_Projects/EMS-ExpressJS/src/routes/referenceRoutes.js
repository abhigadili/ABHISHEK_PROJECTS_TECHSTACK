const router = require('express').Router();
const c = require('../controllers/referenceController');
const v = require('../validators/referenceValidators');
const validate = require('../middleware/validate');
const { authorize } = require('../middleware/auth');
const { ADMINS } = require('../constants');

router.get('/departments', v.list, validate, c.listDepartments);
router.post('/departments', authorize(ADMINS), v.deptCreate, validate, c.createDepartment);
router.get('/departments/:id', v.id, validate, c.getDepartment);
router.put('/departments/:id', authorize(ADMINS), v.deptUpdate, validate, c.updateDepartment);
router.delete('/departments/:id', authorize(ADMINS), v.id, validate, c.deactivateDepartment);
router.post('/departments/:id/activate', authorize(ADMINS), v.id, validate, c.activateDepartment);

router.get('/teams', v.teamList, validate, c.listTeams);
router.post('/teams', authorize(ADMINS), v.teamCreate, validate, c.createTeam);
router.get('/teams/:id', v.id, validate, c.getTeam);
router.put('/teams/:id', authorize(ADMINS), v.teamUpdate, validate, c.updateTeam);
router.put('/teams/:id/members', authorize(ADMINS), v.teamMembers, validate, c.assignMembers);

router.get('/designations', v.list, validate, c.listDesignations);
router.post('/designations', authorize(ADMINS), v.desCreate, validate, c.createDesignation);
router.get('/designations/:id', v.id, validate, c.getDesignation);
router.put('/designations/:id', authorize(ADMINS), v.desUpdate, validate, c.updateDesignation);
module.exports = router;
