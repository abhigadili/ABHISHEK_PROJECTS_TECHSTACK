import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
import { employeeService } from '../services/employee.service';
import { sendSuccess, sendCreated } from '../utils/response.helper';

export const employeeController = {
  async getAll(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { page = 1, pageSize = 10 } = req.query as any;
      const result = await employeeService.getAll(+page, +pageSize);
      sendSuccess(res, result.employees, 'Employees fetched', 200, result.meta);
    } catch (err) { next(err); }
  },
  async getById(req: AuthRequest, res: Response, next: NextFunction) {
    try { sendSuccess(res, await employeeService.getById(req.params.id)); } catch (err) { next(err); }
  },
  async create(req: AuthRequest, res: Response, next: NextFunction) {
    try { sendCreated(res, await employeeService.create(req.body), 'Employee created'); } catch (err) { next(err); }
  },
  async update(req: AuthRequest, res: Response, next: NextFunction) {
    try { sendSuccess(res, await employeeService.update(req.params.id, req.body), 'Employee updated'); } catch (err) { next(err); }
  },
  async delete(req: AuthRequest, res: Response, next: NextFunction) {
    try { await employeeService.delete(req.params.id); sendSuccess(res, null, 'Employee deleted'); } catch (err) { next(err); }
  },
};
