import { Router } from 'express';
import { Db, asyncHandler as h, authenticate, idParam, rateLimiter, requirePermission, validate, z } from '@hr/common';
import { AuthController } from '../controllers/auth.controller';
import {
  assignRolesDto, changePasswordDto, createUserDto, forgotPasswordDto, linkEmployeeDto, loginDto, logoutDto, passwordSchema, refreshDto,
  resetPasswordDto, rolePermissionsDto, updateUserDto, userListQuery,
} from '../dto/auth.dto';
import { AuthService } from '../services/auth.service';
import { UserService } from '../services/user.service';

export function buildAuth(db: Db) {
  const auth = new AuthService(db);
  const users = new UserService(db, auth);
  return { auth, users, controller: new AuthController(auth, users) };
}

export function publicRoutes(r: Router, db: Db): void {
  const { controller: c } = buildAuth(db);
  r.post('/auth/login', rateLimiter(30), validate({ body: loginDto }), h(c.login));
  r.post('/auth/refresh', rateLimiter(60), validate({ body: refreshDto }), h(c.refresh));
  r.post('/auth/password/forgot', rateLimiter(10), validate({ body: forgotPasswordDto }), h(c.forgot));
  r.post('/auth/password/reset', rateLimiter(10), validate({ body: resetPasswordDto }), h(c.reset));
}

export function securedRoutes(r: Router, db: Db): void {
  const { controller: c } = buildAuth(db);
  r.post('/auth/logout', validate({ body: logoutDto }), h(c.logout));
  r.get('/auth/me', h(c.me));
  r.post('/auth/password/change', validate({ body: changePasswordDto }), h(c.changePassword));

  const manage = requirePermission('USER_MANAGE');
  r.get('/auth/users', manage, validate({ query: userListQuery }), h(c.listUsers));
  r.post('/auth/users', manage, validate({ body: createUserDto }), h(c.createUser));
  r.get('/auth/users/:id', manage, validate({ params: idParam }), h(c.getUser));
  r.patch('/auth/users/:id', manage, validate({ params: idParam, body: updateUserDto }), h(c.updateUser));
  r.put('/auth/users/:id/roles', manage, validate({ params: idParam, body: assignRolesDto }), h(c.assignRoles));
  r.post('/auth/users/:id/activate', manage, validate({ params: idParam }), h(c.activate));
  r.post('/auth/users/:id/deactivate', manage, validate({ params: idParam }), h(c.deactivate));
  r.post('/auth/users/:id/unlock', manage, validate({ params: idParam }), h(c.unlock));
  r.put('/auth/users/:id/employee', manage, validate({ params: idParam, body: linkEmployeeDto }), h(c.linkEmployee));
  r.post('/auth/users/:id/password-reset', manage, validate({ params: idParam, body: z.object({ newPassword: passwordSchema }) }), h(c.resetPassword));
  r.get('/auth/users/:id/history', manage, validate({ params: idParam }), h(c.history));
  r.get('/auth/roles', manage, h(c.listRoles));
  r.put('/auth/roles/:id/permissions', manage, validate({ params: idParam, body: rolePermissionsDto }), h(c.setRolePermissions));
  r.get('/auth/permissions', manage, h(c.listPermissions));
}
