// ============================================================
// WHAT: Company business-logic service
// WHY:  Services separate business logic from HTTP concerns.
//       The controller handles req/res; the service handles data.
//       This means services are testable without HTTP setup.
// Interview Tip: Layered architecture (Controller → Service → Repository/Model)
//               is the most common enterprise Node.js pattern.
// ============================================================

import { Company, ICompany } from '../models/company.model';
import { cacheGet, cacheSet, cacheDel } from '../cache/redis.client';
import { CACHE_KEYS } from '../constants';
import { NotFoundError } from '../exceptions';
import { config } from '../config/env.config';
import { buildPaginationMeta } from '../utils/response.helper';

export const companyService = {

  async getAll(query: { page: number; pageSize: number; search?: string; sort?: string; order?: string }) {
    const { page, pageSize, search, sort = 'name', order = 'asc' } = query;

    // Try cache first (only for first page, no search)
    if (page === 1 && !search) {
      const cached = await cacheGet<{ companies: ICompany[]; meta: any }>(CACHE_KEYS.COMPANIES);
      if (cached) return cached;
    }

    const filter = search
      ? { $text: { $search: search }, isActive: true }
      : { isActive: true };

    const sortObj: Record<string, 1 | -1> = { [sort]: order === 'asc' ? 1 : -1 };

    const [companies, total] = await Promise.all([
      Company.find(filter).sort(sortObj).skip((page - 1) * pageSize).limit(pageSize),
      Company.countDocuments(filter),
    ]);

    const result = { companies, meta: buildPaginationMeta(total, page, pageSize) };

    if (page === 1 && !search) {
      await cacheSet(CACHE_KEYS.COMPANIES, result, config.redis.ttl);
    }

    return result;
  },

  async getById(id: string) {
    const cached = await cacheGet<ICompany>(CACHE_KEYS.COMPANY(id));
    if (cached) return cached;

    const company = await Company.findById(id);
    if (!company) throw new NotFoundError('Company');

    await cacheSet(CACHE_KEYS.COMPANY(id), company, config.redis.ttl);
    return company;
  },

  async create(data: Partial<ICompany>) {
    const company = await Company.create(data);
    // Invalidate list cache after write
    await cacheDel(CACHE_KEYS.COMPANIES);
    return company;
  },

  async update(id: string, data: Partial<ICompany>) {
    const company = await Company.findByIdAndUpdate(id, data, { new: true, runValidators: true });
    if (!company) throw new NotFoundError('Company');
    await cacheDel(CACHE_KEYS.COMPANIES, CACHE_KEYS.COMPANY(id));
    return company;
  },

  async patch(id: string, data: Partial<ICompany>) {
    return companyService.update(id, data);
  },

  async delete(id: string) {
    const company = await Company.findByIdAndUpdate(id, { isActive: false }, { new: true });
    if (!company) throw new NotFoundError('Company');
    await cacheDel(CACHE_KEYS.COMPANIES, CACHE_KEYS.COMPANY(id));
    return company;
  },
};
