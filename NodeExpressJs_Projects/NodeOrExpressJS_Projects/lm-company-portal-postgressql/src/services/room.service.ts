import { query, getClient } from '../database/connection';
import { cacheGet, cacheSet, cacheDel } from '../cache/redis.client';
import { CACHE_KEYS } from '../constants';
import { NotFoundError, ValidationError } from '../exceptions';
import { buildPaginationMeta } from '../utils/response.helper';
import { IRoom } from '../types/entities';

export const roomService = {

  async getAll(page = 1, pageSize = 10) {
    const offset = (page - 1) * pageSize;
    const [rooms, countResult] = await Promise.all([
      query<IRoom>('SELECT * FROM rooms ORDER BY room_name ASC LIMIT $1 OFFSET $2', [pageSize, offset]),
      query<{ total: number }>('SELECT COUNT(*)::int AS total FROM rooms'),
    ]);
    return { rooms, meta: buildPaginationMeta(countResult[0]?.total ?? 0, page, pageSize) };
  },

  async getById(id: string) {
    const rows = await query<IRoom>('SELECT * FROM rooms WHERE id = $1', [id]);
    if (!rows[0]) throw new NotFoundError('Room');
    return rows[0];
  },

  async create(data: Partial<IRoom>) {
    const rows = await query<IRoom>(`
      INSERT INTO rooms (room_name, capacity, floor, building, is_available)
      VALUES ($1, $2, $3, $4, $5) RETURNING *
    `, [data.room_name, data.capacity, data.floor, data.building, data.is_available ?? true]);
    await cacheDel(CACHE_KEYS.ROOMS, CACHE_KEYS.AVAILABLE_ROOMS);
    return rows[0];
  },

  async update(id: string, data: Partial<IRoom>) {
    const rows = await query<IRoom>(`
      UPDATE rooms SET room_name=$1, capacity=$2, floor=$3, building=$4, is_available=$5, updated_at=NOW()
      WHERE id=$6 RETURNING *
    `, [data.room_name, data.capacity, data.floor, data.building, data.is_available, id]);
    if (!rows[0]) throw new NotFoundError('Room');
    await cacheDel(CACHE_KEYS.ROOMS, CACHE_KEYS.ROOM(id), CACHE_KEYS.AVAILABLE_ROOMS);
    return rows[0];
  },

  async delete(id: string) {
    const rows = await query<IRoom>('DELETE FROM rooms WHERE id=$1 RETURNING *', [id]);
    if (!rows[0]) throw new NotFoundError('Room');
    await cacheDel(CACHE_KEYS.ROOMS, CACHE_KEYS.ROOM(id), CACHE_KEYS.AVAILABLE_ROOMS);
    return rows[0];
  },

  async getAvailable(date: string) {
    const cacheKey = `${CACHE_KEYS.AVAILABLE_ROOMS}:${date}`;
    const cached = await cacheGet<IRoom[]>(cacheKey);
    if (cached) return cached;

    // Rooms that are marked available AND have no overlapping scheduled booking on that date
    const rows = await query<IRoom>(`
      SELECT r.* FROM rooms r
      WHERE r.is_available = TRUE
        AND r.id NOT IN (
          SELECT DISTINCT room_id FROM meetings
          WHERE status = 'scheduled'
            AND start_time < ($1::date + INTERVAL '1 day')
            AND end_time   > $1::date
        )
      ORDER BY r.room_name
    `, [date]);

    await cacheSet(cacheKey, rows, 60);
    return rows;
  },

  async bookRoom(data: { roomId: string; bookedBy: string; startTime: string; endTime: string; title: string; attendees?: string[] }) {
    const room = await roomService.getById(data.roomId);
    if (!room.is_available) throw new ValidationError('Room is not available for booking');

    // Check for overlapping bookings (parameterized — SQL injection safe)
    const conflicts = await query(`
      SELECT id FROM meetings
      WHERE room_id = $1 AND status = 'scheduled'
        AND start_time < $3 AND end_time > $2
    `, [data.roomId, data.startTime, data.endTime]);

    if (conflicts.length > 0) throw new ValidationError('Room is already booked in this time slot');

    const client = await getClient();
    try {
      await client.query('BEGIN');

      const meetingRes = await client.query(`
        INSERT INTO meetings (title, room_id, booked_by, start_time, end_time)
        VALUES ($1, $2, $3, $4, $5) RETURNING *
      `, [data.title, data.roomId, data.bookedBy, data.startTime, data.endTime]);

      const meeting = meetingRes.rows[0];

      if (data.attendees?.length) {
        for (const empId of data.attendees) {
          await client.query(
            'INSERT INTO meeting_attendees (meeting_id, employee_id) VALUES ($1, $2)',
            [meeting.id, empId]
          );
        }
      }

      await client.query('COMMIT');
      await cacheDel(CACHE_KEYS.AVAILABLE_ROOMS);
      return meeting;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  async cancelBooking(meetingId: string, userId: string) {
    const rows = await query(`
      UPDATE meetings SET status='cancelled', updated_at=NOW()
      WHERE id=$1 AND booked_by=$2 AND status='scheduled'
      RETURNING *
    `, [meetingId, userId]);
    if (!rows[0]) throw new NotFoundError('Booking');
    await cacheDel(CACHE_KEYS.AVAILABLE_ROOMS);
    return rows[0];
  },
};
