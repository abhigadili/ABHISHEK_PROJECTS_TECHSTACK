// Augment Express namespace so req.user matches our JwtPayload shape
// WHY: Passport declares req.user as Express.User. We override it here
//      so our middleware/controller types are consistent throughout.

import { JwtPayload } from './index';

declare global {
  namespace Express {
    interface User extends JwtPayload {}
    interface Request {
      requestId?: string;
    }
  }
}
