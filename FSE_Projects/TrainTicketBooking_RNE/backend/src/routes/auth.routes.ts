import { Router } from 'express';
import { authController as c } from '../controllers';
import { authenticate } from '../middlewares/auth';
import { validate } from '../middlewares/validate';
import { authLimiter } from '../middlewares/rateLimit';
import { changePasswordSchema, forgotSchema, loginSchema, registerSchema, resetSchema } from '../validations/auth';
const r = Router();
r.use(authLimiter); // router-level middleware: brute-force protection for every auth endpoint
r.post('/register', validate('body', registerSchema), c.register);
r.post('/login', validate('body', loginSchema), c.login);
r.post('/refresh', c.refresh);
r.post('/logout', c.logout);
r.post('/forgot-password', validate('body', forgotSchema), c.forgot);
r.post('/reset-password', validate('body', resetSchema), c.reset);
r.post('/change-password', authenticate, validate('body', changePasswordSchema), c.change);
r.get('/me', authenticate, c.me);
export default r;
