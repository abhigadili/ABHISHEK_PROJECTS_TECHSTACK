import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
import { companyService } from '../services/company.service';
import { sendSuccess, sendCreated } from '../utils/response.helper';

export const companyController = {

  async getAll(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { page = 1, pageSize = 10, search, sort, order } = req.query as any;
      const result = await companyService.getAll({ page: +page, pageSize: +pageSize, search, sort, order });
      sendSuccess(res, result.companies, 'Companies fetched', 200, result.meta);
    } catch (err) { next(err); }
  },

  async getById(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const company = await companyService.getById(req.params.id);
      sendSuccess(res, company);
    } catch (err) { next(err); }
  },

  async create(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const company = await companyService.create(req.body);
      sendCreated(res, company, 'Company created');
    } catch (err) { next(err); }
  },

  async update(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const company = await companyService.update(req.params.id, req.body);
      sendSuccess(res, company, 'Company updated');
    } catch (err) { next(err); }
  },

  async patch(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const company = await companyService.patch(req.params.id, req.body);
      sendSuccess(res, company, 'Company patched');
    } catch (err) { next(err); }
  },

  async delete(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      await companyService.delete(req.params.id);
      sendSuccess(res, null, 'Company deactivated');
    } catch (err) { next(err); }
  },
};
