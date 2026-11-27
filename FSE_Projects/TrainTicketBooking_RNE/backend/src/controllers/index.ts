import type { Request, Response } from 'express';
import { env } from '../config/env';
import { asyncHandler, created, ok, paged, idParam } from '../utils/http';
import { authService } from '../services/auth.service';
import { userService } from '../services/user.service';
import { stationService } from '../services/station.service';
import { trainService } from '../services/train.service';
import { availabilityService } from '../services/availability.service';
import { bookingService, type Actor } from '../services/booking.service';
import { paymentService, refundService } from '../services/payment.service';
import { passengerService } from '../services/passenger.service';
import { notificationService } from '../services/notification.service';
import { statsService } from '../services/stats.service';
import { can } from '../middlewares/auth';
import { q } from '../middlewares/validate';
import { unauthorized } from '../utils/errors';
import { clearPermissionCache } from '../services/rbac.service';
import type { RoleKey } from '../constants/rbac';

/** Controllers stay thin: parse request -> call ONE service -> shape the response. No queries, no business rules here. */
const RT_COOKIE = 'ttb_rt';
const cookieOpts = { httpOnly: true, secure: env.cookieSecure, sameSite: 'lax' as const, path: '/api/auth', maxAge: env.REFRESH_TOKEN_EXPIRY_DAYS * 86_400_000 };
const setRefresh = (res: Response, token: string) => res.cookie(RT_COOKIE, token, cookieOpts);
const actorOf = async (req: Request): Promise<Actor> => ({ id: req.user!.id, canReadAll: await can(req, 'booking:read-all'), canCancelAny: await can(req, 'booking:cancel-any') });
const id = (req: Request, name = 'id') => idParam(req.params[name] as string, name);

export const authController = {
  register: asyncHandler(async (req, res) => created(res, await authService.register(req.body))),
  login: asyncHandler(async (req, res) => { const r = await authService.login(req.body.email, req.body.password, req.headers['user-agent']); setRefresh(res, r.refreshToken); ok(res, { user: r.user, accessToken: r.accessToken }); }),
  refresh: asyncHandler(async (req, res) => {
    const raw = req.cookies?.[RT_COOKIE] as string | undefined; if (!raw) throw unauthorized('No refresh token');
    try { const r = await authService.refresh(raw, req.headers['user-agent']); setRefresh(res, r.refreshToken); ok(res, { user: r.user, accessToken: r.accessToken }); } catch (e) { res.clearCookie(RT_COOKIE, { path: cookieOpts.path }); throw e; }
  }),
  logout: asyncHandler(async (req, res) => { await authService.logout(req.cookies?.[RT_COOKIE]); res.clearCookie(RT_COOKIE, { path: cookieOpts.path }); ok(res, null); }),
  forgot: asyncHandler(async (req, res) => { await authService.forgotPassword(req.body.email); ok(res, { message: 'If that e-mail is registered, a reset link has been sent.' }); }),
  reset: asyncHandler(async (req, res) => { await authService.resetPassword(req.body.token, req.body.password); ok(res, null); }),
  change: asyncHandler(async (req, res) => { await authService.changePassword(req.user!.id, req.body.currentPassword, req.body.newPassword, req.cookies?.[RT_COOKIE]); ok(res, null); }),
  me: asyncHandler(async (req, res) => ok(res, await authService.me(req.user!.id))),
};
export const userController = {
  list: asyncHandler(async (req, res) => { const p = q<Parameters<typeof userService.list>[0]>(req); const r = await userService.list(p); paged(res, r.items, r.total, p.page, p.size); }),
  get: asyncHandler(async (req, res) => ok(res, await userService.get(id(req), req.user!, await can(req, 'user:read')))),
  update: asyncHandler(async (req, res) => ok(res, await userService.update(id(req), req.user!, await can(req, 'user:manage'), req.body))),
  status: asyncHandler(async (req, res) => ok(res, await userService.setStatus(id(req), req.user!.id, req.body.status))),
  roles: asyncHandler(async (req, res) => ok(res, await userService.setRoles(id(req), req.user!.id, req.body.roles as RoleKey[]))),
  remove: asyncHandler(async (req, res) => { await userService.remove(id(req), req.user!.id); ok(res, null); }),
  clearCache: () => clearPermissionCache(),
};
export const stationController = {
  list: asyncHandler(async (req, res) => { const p = q<Parameters<typeof stationService.list>[0]>(req); const r = await stationService.list(p); paged(res, r.items, r.total, p.page, p.size); }),
  get: asyncHandler(async (req, res) => ok(res, await stationService.get(id(req)))),
  create: asyncHandler(async (req, res) => created(res, await stationService.create(req.body))),
  update: asyncHandler(async (req, res) => ok(res, await stationService.update(id(req), req.body))),
  remove: asyncHandler(async (req, res) => { await stationService.remove(id(req)); ok(res, null); }),
};
export const trainController = {
  list: asyncHandler(async (req, res) => { const p = q<Parameters<typeof trainService.list>[0]>(req); const r = await trainService.list(p); paged(res, r.items, r.total, p.page, p.size); }),
  get: asyncHandler(async (req, res) => ok(res, await trainService.get(id(req)))),
  create: asyncHandler(async (req, res) => created(res, await trainService.create(req.body))),
  update: asyncHandler(async (req, res) => ok(res, await trainService.update(id(req), req.body))),
  status: asyncHandler(async (req, res) => ok(res, await trainService.setStatus(id(req), req.body.status, req.body.reason))),
  remove: asyncHandler(async (req, res) => { await trainService.remove(id(req)); ok(res, null); }),
  search: asyncHandler(async (req, res) => ok(res, await availabilityService.search(q(req)))),
  availability: asyncHandler(async (req, res) => { const a = req.query; ok(res, await availabilityService.trainAvailability(id(req), String(a.date), a.from ? Number(a.from) : undefined, a.to ? Number(a.to) : undefined)); }),
  coaches: asyncHandler(async (req, res) => ok(res, await trainService.coaches(id(req)))),
  addCoach: asyncHandler(async (req, res) => created(res, await trainService.addCoach(id(req), req.body))),
  override: asyncHandler(async (req, res) => ok(res, await trainService.setDateOverride(id(req), req.body.date, req.body.cancelled, req.body.reason))),
  removeOverride: asyncHandler(async (req, res) => { await trainService.removeDateOverride(id(req), id(req, 'overrideId')); ok(res, null); }),
  coachTypes: asyncHandler(async (_req, res) => ok(res, await trainService.coachTypes())),
  seatTypes: asyncHandler(async (_req, res) => ok(res, await trainService.seatTypes())),
};
export const routeController = {
  list: asyncHandler(async (req, res) => { const p = q<{ page: number; size: number; q?: string }>(req); const r = await trainService.routes(p); paged(res, r.items, r.total, p.page, p.size); }),
  get: asyncHandler(async (req, res) => ok(res, await trainService.route(id(req)))),
  create: asyncHandler(async (req, res) => created(res, await trainService.createRoute(req.body.trainId, req.body))),
  update: asyncHandler(async (req, res) => ok(res, await trainService.updateRoute(id(req), req.body))),
};
export const scheduleController = {
  list: asyncHandler(async (req, res) => { const p = q<{ page: number; size: number; trainId?: number }>(req); const r = await trainService.schedules(p); paged(res, r.items, r.total, p.page, p.size); }),
  get: asyncHandler(async (req, res) => ok(res, await trainService.schedule(id(req)))),
  create: asyncHandler(async (req, res) => created(res, await trainService.createSchedule(req.body))),
  update: asyncHandler(async (req, res) => ok(res, await trainService.updateSchedule(id(req), req.body))),
  remove: asyncHandler(async (req, res) => { await trainService.removeSchedule(id(req)); ok(res, null); }),
};
export const coachController = {
  seats: asyncHandler(async (req, res) => ok(res, await trainService.seats(id(req)))),
  remove: asyncHandler(async (req, res) => { await trainService.removeCoach(id(req)); ok(res, null); }),
  seatMap: asyncHandler(async (req, res) => { const a = q<{ trainId: number; date: string; from: number; to: number; coachTypeId: number }>(req); ok(res, await availabilityService.seatMap(a.trainId, a.date, a.from, a.to, a.coachTypeId)); }),
  seatStatus: asyncHandler(async (req, res) => ok(res, await trainService.setSeatStatus(id(req), req.body.status))),
};
export const bookingController = {
  create: asyncHandler(async (req, res) => created(res, await bookingService.create(req.user!.id, req.body))),
  list: asyncHandler(async (req, res) => { const p = q<Parameters<typeof bookingService.list>[1]>(req); const r = await bookingService.list(await actorOf(req), p); paged(res, r.items, r.total, p.page, p.size); }),
  get: asyncHandler(async (req, res) => ok(res, await bookingService.get(id(req), await actorOf(req)))),
  byPnr: asyncHandler(async (req, res) => ok(res, await bookingService.byPnr(String(req.params.pnr), await actorOf(req)))),
  quote: asyncHandler(async (req, res) => { const ids = req.query.passengerIds ? String(req.query.passengerIds).split(',').map(Number).filter(Boolean) : undefined; const r = await bookingService.quote(id(req), await actorOf(req), ids); ok(res, { hoursBefore: r.hoursBefore, rule: r.rule, grossFare: r.grossFare, chargeAmount: r.chargeAmount, refundAmount: r.refundAmount, passengers: r.passengers.map((p) => ({ id: p.id, name: p.name, fare: p.fare })) }); }),
  cancel: asyncHandler(async (req, res) => ok(res, await bookingService.cancel(id(req), await actorOf(req), req.body))),
  cancellations: asyncHandler(async (req, res) => { const p = q<{ page: number; size: number }>(req); const r = await bookingService.cancellations(p); paged(res, r.items, r.total, p.page, p.size); }),
  rules: asyncHandler(async (_req, res) => ok(res, await bookingService.rules())),
  setRules: asyncHandler(async (req, res) => ok(res, await bookingService.setRules(req.body.rules))),
};
export const passengerController = {
  list: asyncHandler(async (req, res) => { const p = q<{ page: number; size: number; q?: string; userId?: number }>(req); const r = await passengerService.list(req.user!.id, await can(req, 'booking:read-all'), p); paged(res, r.items, r.total, p.page, p.size); }),
  get: asyncHandler(async (req, res) => ok(res, await passengerService.get(id(req), req.user!.id, await can(req, 'booking:read-all')))),
  create: asyncHandler(async (req, res) => created(res, await passengerService.create(req.user!.id, req.body))),
  update: asyncHandler(async (req, res) => ok(res, await passengerService.update(id(req), req.user!.id, await can(req, 'booking:read-all'), req.body))),
  remove: asyncHandler(async (req, res) => { await passengerService.remove(id(req), req.user!.id, await can(req, 'booking:read-all')); ok(res, null); }),
  history: asyncHandler(async (req, res) => ok(res, await passengerService.history(id(req), req.user!.id, await can(req, 'booking:read-all')))),
};
export const paymentController = {
  initiate: asyncHandler(async (req, res) => created(res, await paymentService.initiate(await actorOf(req), req.body))),
  confirm: asyncHandler(async (req, res) => ok(res, await paymentService.confirm(id(req), await actorOf(req), req.body.outcome))),
  get: asyncHandler(async (req, res) => ok(res, await paymentService.get(id(req), await actorOf(req)))),
  receipt: asyncHandler(async (req, res) => ok(res, await paymentService.receipt(id(req), await actorOf(req)))),
  list: asyncHandler(async (req, res) => { const p = q<{ page: number; size: number; status?: string; q?: string }>(req); const r = await paymentService.list(await actorOf(req), p); paged(res, r.items, r.total, p.page, p.size); }),
};
export const refundController = {
  list: asyncHandler(async (req, res) => { const p = q<{ page: number; size: number }>(req); const r = await refundService.list(await actorOf(req), p); paged(res, r.items, r.total, p.page, p.size); }),
  get: asyncHandler(async (req, res) => ok(res, await refundService.get(id(req), await actorOf(req)))),
};
export const notificationController = {
  list: asyncHandler(async (req, res) => { const p = q<{ unread?: boolean; page: number; size: number }>(req); const r = await notificationService.list(req.user!.id, p); ok(res, { items: r.items, unread: r.unread }, { page: p.page, size: p.size, total: r.total, totalPages: Math.max(1, Math.ceil(r.total / p.size)) }); }),
  read: asyncHandler(async (req, res) => { await notificationService.markRead(req.user!.id, id(req)); ok(res, null); }),
  readAll: asyncHandler(async (req, res) => { await notificationService.markAllRead(req.user!.id); ok(res, null); }),
  prefs: asyncHandler(async (req, res) => ok(res, await notificationService.preferences(req.user!.id))),
  setPrefs: asyncHandler(async (req, res) => ok(res, await notificationService.setPreferences(req.user!.id, req.body))),
};
export const statsController = { dashboard: asyncHandler(async (_req, res) => ok(res, await statsService.dashboard())) };
