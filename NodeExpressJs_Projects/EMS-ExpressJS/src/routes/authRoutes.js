const router = require('express').Router();
const c = require('../controllers/authController');
const v = require('../validators/authValidators');
const validate = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const limiter = require('../middleware/rateLimiters');

const { optionalImageUpload } = require('../middleware/upload');
// Public self-registration + the two read-only helpers the form needs before anyone is signed in
router.post('/register', limiter.sensitive, optionalImageUpload, v.register, validate, c.register);
router.get('/registration-options', c.registrationOptions);
router.get('/username-available', v.usernameAvailable, validate, c.usernameAvailable);
router.post('/login', limiter.login, v.login, validate, c.login);
router.post('/refresh', limiter.sensitive, v.refresh, validate, c.refresh);
router.post('/logout', v.logout, validate, c.logout);
router.post('/logout-all', authenticate, c.logoutAll);
router.get('/me', authenticate, c.me);
router.post('/forgot-password', limiter.sensitive, v.forgot, validate, c.forgot);
router.post('/reset-password', limiter.sensitive, v.reset, validate, c.reset);
router.post('/change-password', authenticate, limiter.sensitive, v.change, validate, c.change);
module.exports = router;
