import { Room, IRoom } from '../models/room.model';
import { Meeting } from '../models/meeting.model';
import { cacheGet, cacheSet, cacheDel } from '../cache/redis.client';
import { CACHE_KEYS } from '../constants';
import { NotFoundError, ValidationError } from '../exceptions';
import { config } from '../config/env.config';
import { buildPaginationMeta } from '../utils/response.helper';
import { Types } from 'mongoose';

export const roomService = {

  async getAll(page = 1, pageSize = 10) {
    const [rooms, total] = await Promise.all([
      Room.find().skip((page-1)*pageSize).limit(pageSize),
      Room.countDocuments(),
    ]);
    return { rooms, meta: buildPaginationMeta(total, page, pageSize) };
  },

  async getById(id: string) {
    const room = await Room.findById(id);
    if (!room) throw new NotFoundError('Room');
    return room;
  },

  async create(data: Partial<IRoom>) {
    const room = await Room.create(data);
    await cacheDel(CACHE_KEYS.ROOMS, CACHE_KEYS.AVAILABLE_ROOMS);
    return room;
  },

  async update(id: string, data: Partial<IRoom>) {
    const room = await Room.findByIdAndUpdate(id, data, { new: true, runValidators: true });
    if (!room) throw new NotFoundError('Room');
    await cacheDel(CACHE_KEYS.ROOMS, CACHE_KEYS.ROOM(id), CACHE_KEYS.AVAILABLE_ROOMS);
    return room;
  },

  async delete(id: string) {
    const room = await Room.findByIdAndDelete(id);
    if (!room) throw new NotFoundError('Room');
    await cacheDel(CACHE_KEYS.ROOMS, CACHE_KEYS.ROOM(id), CACHE_KEYS.AVAILABLE_ROOMS);
    return room;
  },

  async getAvailable(date: string) {
    const cacheKey = `${CACHE_KEYS.AVAILABLE_ROOMS}:${date}`;
    const cached = await cacheGet(cacheKey);
    if (cached) return cached;

    // All rooms that are marked available
    const rooms = await Room.find({ isAvailable: true });

    // Filter out rooms that have bookings overlapping the requested date
    const targetDate = new Date(date);
    const dayStart = new Date(targetDate.setHours(0, 0, 0, 0));
    const dayEnd   = new Date(targetDate.setHours(23, 59, 59, 999));

    const bookedRoomIds = await Meeting.distinct('roomId', {
      status: 'scheduled',
      startTime: { $lte: dayEnd },
      endTime: { $gte: dayStart },
    });

    const available = rooms.filter(r => !bookedRoomIds.some(id => id.equals(r._id as Types.ObjectId)));
    await cacheSet(cacheKey, available, 60); // short TTL — availability changes often
    return available;
  },

  async bookRoom(data: { roomId: string; bookedBy: string; startTime: string; endTime: string; title: string; attendees?: string[] }) {
    const room = await Room.findById(data.roomId);
    if (!room) throw new NotFoundError('Room');
    if (!room.isAvailable) throw new ValidationError('Room is not available for booking');

    const start = new Date(data.startTime);
    const end   = new Date(data.endTime);

    // Check for overlapping bookings
    const conflict = await Meeting.findOne({
      roomId: data.roomId,
      status: 'scheduled',
      $or: [{ startTime: { $lt: end }, endTime: { $gt: start } }],
    });
    if (conflict) throw new ValidationError('Room is already booked in this time slot');

    const meeting = await Meeting.create({
      title:    data.title,
      roomId:   data.roomId,
      bookedBy: data.bookedBy,
      attendees: data.attendees ?? [],
      startTime: start,
      endTime:   end,
    });

    await cacheDel(CACHE_KEYS.AVAILABLE_ROOMS);
    return meeting;
  },

  async cancelBooking(meetingId: string, userId: string) {
    const meeting = await Meeting.findOneAndUpdate(
      { _id: meetingId, bookedBy: userId, status: 'scheduled' },
      { status: 'cancelled' },
      { new: true }
    );
    if (!meeting) throw new NotFoundError('Booking');
    await cacheDel(CACHE_KEYS.AVAILABLE_ROOMS);
    return meeting;
  },
};
