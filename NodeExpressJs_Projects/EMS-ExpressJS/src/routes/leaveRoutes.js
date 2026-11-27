const router = require('express').Router();
const c = require('../controllers/leaveController');
const v = require('../validators/leaveValidators');
const validate = require('../middleware/validate');
const { authorize } = require('../middleware/auth');
const { documentUpload } = require('../middleware/upload');
const { ADMINS, MANAGERS_UP } = require('../constants');

router.get('/types', c.listTypes);
router.post('/types', authorize(ADMINS), v.typeCreate, validate, c.createType);
router.put('/types/:id', authorize(ADMINS), v.typeUpdate, validate, c.updateType);

router.get('/balances', v.balances, validate, c.myBalances);
router.get('/balances/employees/:id', v.employeeBalances, validate, c.employeeBalances);
router.post('/balances/adjust', authorize(ADMINS), v.adjust, validate, c.adjust);
router.get('/history', v.balances, validate, c.myHistory);
router.get('/history/employees/:id', v.employeeBalances, validate, c.employeeHistory);

router.post('/requests', v.apply, validate, c.apply);
router.get('/requests', v.list, validate, c.list);
router.get('/requests/me', v.list, validate, c.mine);
router.get('/requests/pending-approvals', authorize(MANAGERS_UP), v.list, validate, c.pending);
router.get('/team', authorize(MANAGERS_UP), v.team, validate, c.team);
router.get('/requests/:id', v.id, validate, c.get);
router.post('/requests/:id/approve', authorize(MANAGERS_UP), v.decide, validate, c.approve);
router.post('/requests/:id/reject', authorize(MANAGERS_UP), v.decide, validate, c.reject);
router.post('/requests/:id/cancel', v.decide, validate, c.cancel);
router.post('/requests/:id/documents', v.id, validate, documentUpload, c.addDocument);
router.get('/requests/:id/documents/:docId', v.doc, validate, c.getDocument);
module.exports = router;
