import type { Request, Response } from 'express';
import { created, noContent, ok, pageRequest } from '@hr/common';
import type { AuthService } from '../services/auth.service';
import type { UserService } from '../services/user.service';

/** Controllers only translate HTTP <-> service calls; no business logic here. */
export class AuthController {
  constructor(private readonly auth: AuthService, private readonly users: UserService) {}

  login = async (req: Request, res: Response) => ok(res, await this.auth.login(req.valid.body.username, req.valid.body.password, req.ip));
  refresh = async (req: Request, res: Response) => ok(res, await this.auth.refresh(req.valid.body.refreshToken, req.ip));
  logout = async (req: Request, res: Response) => { await this.auth.logout(req.valid.body?.refreshToken); noContent(res); };
  me = async (req: Request, res: Response) => ok(res, await this.auth.me(req.user!.userId));
  changePassword = async (req: Request, res: Response) => { await this.auth.changePassword(req.user!.userId, req.valid.body.currentPassword, req.valid.body.newPassword); noContent(res); };
  forgot = async (req: Request, res: Response) => { await this.auth.forgotPassword(req.valid.body.email); ok(res, { message: 'If the account exists, a reset message has been sent' }); };
  reset = async (req: Request, res: Response) => { await this.auth.resetPassword(req.valid.body.token, req.valid.body.newPassword); noContent(res); };

  listUsers = async (req: Request, res: Response) => ok(res, await this.users.list(pageRequest(req.valid.query), req.valid.query.q, req.valid.query.status));
  getUser = async (req: Request, res: Response) => ok(res, await this.users.get(req.params.id));
  createUser = async (req: Request, res: Response) => created(res, await this.users.create(req.valid.body));
  updateUser = async (req: Request, res: Response) => ok(res, await this.users.update(req.params.id, req.valid.body));
  assignRoles = async (req: Request, res: Response) => ok(res, await this.users.assignRoles(req.params.id, req.valid.body.roles));
  activate = async (req: Request, res: Response) => ok(res, await this.users.setStatus(req.params.id, 'ACTIVE'));
  deactivate = async (req: Request, res: Response) => ok(res, await this.users.setStatus(req.params.id, 'INACTIVE'));
  unlock = async (req: Request, res: Response) => ok(res, await this.users.unlock(req.params.id));
  linkEmployee = async (req: Request, res: Response) => ok(res, await this.users.linkEmployee(req.params.id, req.valid.body.employeeId));
  resetPassword = async (req: Request, res: Response) => { await this.users.adminResetPassword(req.params.id, req.valid.body.newPassword); noContent(res); };
  history = async (req: Request, res: Response) => ok(res, await this.users.history(req.params.id));
  listRoles = async (_req: Request, res: Response) => ok(res, await this.users.listRoles());
  listPermissions = async (_req: Request, res: Response) => ok(res, await this.users.listPermissions());
  setRolePermissions = async (req: Request, res: Response) => ok(res, await this.users.setRolePermissions(req.params.id, req.valid.body.permissions));
}
