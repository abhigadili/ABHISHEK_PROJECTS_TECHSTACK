import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
import { roomService } from '../services/room.service';
import { sendSuccess, sendCreated } from '../utils/response.helper';
import { UnauthorizedError } from '../exceptions';

export const roomController = {
  async getAll(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { page = 1, pageSize = 10 } = req.query as any;
      const result = await roomService.getAll(+page, +pageSize);
      sendSuccess(res, result.rooms, 'Rooms fetched', 200, result.meta);
    } catch (err) { next(err); }
  },
  async getById(req: AuthRequest, res: Response, next: NextFunction) {
    try { sendSuccess(res, await roomService.getById(req.params.id)); } catch (err) { next(err); }
  },
  async create(req: AuthRequest, res: Response, next: NextFunction) {
    try { sendCreated(res, await roomService.create(req.body), 'Room created'); } catch (err) { next(err); }
  },
  async update(req: AuthRequest, res: Response, next: NextFunction) {
    try { sendSuccess(res, await roomService.update(req.params.id, req.body), 'Room updated'); } catch (err) { next(err); }
  },
  async delete(req: AuthRequest, res: Response, next: NextFunction) {
    try { await roomService.delete(req.params.id); sendSuccess(res, null, 'Room deleted'); } catch (err) { next(err); }
  },
  async getAvailable(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const date = (req.query.date as string) || new Date().toISOString().split('T')[0];
      sendSuccess(res, await roomService.getAvailable(date), 'Available rooms');
    } catch (err) { next(err); }
  },
  async bookRoom(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) throw new UnauthorizedError();
      const meeting = await roomService.bookRoom({ ...req.body, bookedBy: req.user.userId });
      sendCreated(res, meeting, 'Room booked');
    } catch (err) { next(err); }
  },
  async cancelBooking(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) throw new UnauthorizedError();
      const meeting = await roomService.cancelBooking(req.params.id, req.user.userId);
      sendSuccess(res, meeting, 'Booking cancelled');
    } catch (err) { next(err); }
  },
};
