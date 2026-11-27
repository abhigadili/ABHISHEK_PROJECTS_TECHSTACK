import { stationRepo } from '../repositories/station.repository';
import { conflict, notFound } from '../utils/errors';
import type { StationInput } from '../validations/catalog';
export const stationService = {
  async list(q: { page: number; size: number; q?: string; sort?: string; dir: 'asc' | 'desc'; active?: string }) {
    const where = { ...(q.active ? { active: q.active === 'true' } : {}), ...(q.q ? { OR: [{ name: { contains: q.q } }, { code: { contains: q.q } }, { city: { contains: q.q } }, { state: { contains: q.q } }] } : {}) };
    const sortable = ['name', 'code', 'city', 'state']; const [items, total] = await stationRepo.list(where, q.page * q.size, q.size, { [sortable.includes(q.sort ?? '') ? q.sort! : 'name']: q.dir });
    return { items, total };
  },
  async get(id: number) { const s = await stationRepo.byId(id); if (!s) throw notFound('Station'); return s; },
  async create(d: StationInput) { if (await stationRepo.byCode(d.code)) throw conflict('Station code already exists', { code: 'Already exists' }); return stationRepo.create(d); },
  async update(id: number, d: StationInput) { await this.get(id); const other = await stationRepo.byCode(d.code); if (other && other.id !== id) throw conflict('Station code already exists', { code: 'Already exists' }); return stationRepo.update(id, d); },
  /** A station used by a route or booking can only be deactivated (history stays intact). */
  async remove(id: number) { await this.get(id); if ((await stationRepo.stopCount(id)) + (await stationRepo.bookingCount(id)) > 0) throw conflict('This station is used by routes or bookings - deactivate it instead'); await stationRepo.remove(id); },
};
