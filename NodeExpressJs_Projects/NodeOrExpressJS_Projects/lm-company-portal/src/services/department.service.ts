import { Department, IDepartment } from '../models/department.model';
import { cacheGet, cacheSet, cacheDel } from '../cache/redis.client';
import { CACHE_KEYS } from '../constants';
import { NotFoundError } from '../exceptions';
import { config } from '../config/env.config';
import { buildPaginationMeta } from '../utils/response.helper';

export const departmentService = {

  async getAll(page = 1, pageSize = 10) {
    const cached = await cacheGet(CACHE_KEYS.DEPARTMENTS);
    if (cached && page === 1) return cached;

    const [departments, total] = await Promise.all([
      Department.find({ isActive: true }).populate('companyId', 'name').skip((page-1)*pageSize).limit(pageSize),
      Department.countDocuments({ isActive: true }),
    ]);

    const result = { departments, meta: buildPaginationMeta(total, page, pageSize) };
    if (page === 1) await cacheSet(CACHE_KEYS.DEPARTMENTS, result, config.redis.ttl);
    return result;
  },

  async getById(id: string) {
    const dep = await Department.findById(id).populate('companyId', 'name');
    if (!dep) throw new NotFoundError('Department');
    return dep;
  },

  async create(data: Partial<IDepartment>) {
    const dep = await Department.create(data);
    await cacheDel(CACHE_KEYS.DEPARTMENTS);
    return dep;
  },

  async update(id: string, data: Partial<IDepartment>) {
    const dep = await Department.findByIdAndUpdate(id, data, { new: true, runValidators: true });
    if (!dep) throw new NotFoundError('Department');
    await cacheDel(CACHE_KEYS.DEPARTMENTS, CACHE_KEYS.DEPARTMENT(id));
    return dep;
  },

  async delete(id: string) {
    const dep = await Department.findByIdAndUpdate(id, { isActive: false }, { new: true });
    if (!dep) throw new NotFoundError('Department');
    await cacheDel(CACHE_KEYS.DEPARTMENTS, CACHE_KEYS.DEPARTMENT(id));
    return dep;
  },
};
