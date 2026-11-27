import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
import { departmentService } from '../services/department.service';
import { sendSuccess, sendCreated } from '../utils/response.helper';

export const departmentController = {
  async getAll(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { page = 1, pageSize = 10 } = req.query as any;
      const result = await departmentService.getAll(+page, +pageSize) as any;
      sendSuccess(res, result.departments, 'Departments fetched', 200, result.meta);
    } catch (err) { next(err); }
  },
  async getById(req: AuthRequest, res: Response, next: NextFunction) {
    try { sendSuccess(res, await departmentService.getById(req.params.id)); } catch (err) { next(err); }
  },
  async create(req: AuthRequest, res: Response, next: NextFunction) {
    try { sendCreated(res, await departmentService.create(req.body), 'Department created'); } catch (err) { next(err); }
  },
  async update(req: AuthRequest, res: Response, next: NextFunction) {
    try { sendSuccess(res, await departmentService.update(req.params.id, req.body), 'Department updated'); } catch (err) { next(err); }
  },
  async delete(req: AuthRequest, res: Response, next: NextFunction) {
    try { await departmentService.delete(req.params.id); sendSuccess(res, null, 'Department deleted'); } catch (err) { next(err); }
  },
};
