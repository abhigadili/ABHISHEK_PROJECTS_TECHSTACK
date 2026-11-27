const router = require('express').Router();
const c = require('../controllers/employeeController');
const auth = require('../controllers/authController');
const v = require('../validators/employeeValidators');
const authV = require('../validators/authValidators');
const validate = require('../middleware/validate');
const limiter = require('../middleware/rateLimiters');
const { imageUpload } = require('../middleware/upload');

router.get('/', c.profile);
router.patch('/', v.profile, validate, c.updateProfile);
router.get('/picture', c.myPicture);
router.put('/picture', imageUpload, c.putMyPicture);
router.delete('/picture', c.deleteMyPicture);
router.post('/change-password', limiter.sensitive, authV.change, validate, auth.change);
module.exports = router;
