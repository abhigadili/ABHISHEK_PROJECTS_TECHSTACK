import { Employee, IEmployee } from '../models/employee.model';
import { cacheGet, cacheSet, cacheDel } from '../cache/redis.client';
import { CACHE_KEYS } from '../constants';
import { NotFoundError } from '../exceptions';
import { config } from '../config/env.config';
import { buildPaginationMeta } from '../utils/response.helper';

export const employeeService = {

  async getAll(page = 1, pageSize = 10) {
    const [employees, total] = await Promise.all([
      Employee.find({ isActive: true })
        .populate('departmentId', 'name')
        .populate('managerId', 'firstName lastName')
        .skip((page - 1) * pageSize)
        .limit(pageSize),
      Employee.countDocuments({ isActive: true }),
    ]);
    return { employees, meta: buildPaginationMeta(total, page, pageSize) };
  },

  async getById(id: string) {
    const emp = await Employee.findById(id)
      .populate('departmentId', 'name')
      .populate('managerId', 'firstName lastName email');
    if (!emp) throw new NotFoundError('Employee');
    return emp;
  },

  async create(data: Partial<IEmployee>) {
    const emp = await Employee.create(data);
    await cacheDel(CACHE_KEYS.EMPLOYEES);
    return emp;
  },

  async update(id: string, data: Partial<IEmployee>) {
    const emp = await Employee.findByIdAndUpdate(id, data, { new: true, runValidators: true });
    if (!emp) throw new NotFoundError('Employee');
    await cacheDel(CACHE_KEYS.EMPLOYEES, CACHE_KEYS.EMPLOYEE(id));
    return emp;
  },

  async delete(id: string) {
    const emp = await Employee.findByIdAndUpdate(id, { isActive: false }, { new: true });
    if (!emp) throw new NotFoundError('Employee');
    await cacheDel(CACHE_KEYS.EMPLOYEES, CACHE_KEYS.EMPLOYEE(id));
    return emp;
  },
};
