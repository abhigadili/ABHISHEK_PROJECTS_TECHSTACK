"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.roomController = void 0;
const room_service_1 = require("../services/room.service");
const response_helper_1 = require("../utils/response.helper");
const exceptions_1 = require("../exceptions");
exports.roomController = {
    async getAll(req, res, next) {
        try {
            const { page = 1, pageSize = 10 } = req.query;
            const result = await room_service_1.roomService.getAll(+page, +pageSize);
            (0, response_helper_1.sendSuccess)(res, result.rooms, 'Rooms fetched', 200, result.meta);
        }
        catch (err) {
            next(err);
        }
    },
    async getById(req, res, next) {
        try {
            (0, response_helper_1.sendSuccess)(res, await room_service_1.roomService.getById(req.params.id));
        }
        catch (err) {
            next(err);
        }
    },
    async create(req, res, next) {
        try {
            (0, response_helper_1.sendCreated)(res, await room_service_1.roomService.create(req.body), 'Room created');
        }
        catch (err) {
            next(err);
        }
    },
    async update(req, res, next) {
        try {
            (0, response_helper_1.sendSuccess)(res, await room_service_1.roomService.update(req.params.id, req.body), 'Room updated');
        }
        catch (err) {
            next(err);
        }
    },
    async delete(req, res, next) {
        try {
            await room_service_1.roomService.delete(req.params.id);
            (0, response_helper_1.sendSuccess)(res, null, 'Room deleted');
        }
        catch (err) {
            next(err);
        }
    },
    async getAvailable(req, res, next) {
        try {
            const date = req.query.date || new Date().toISOString().split('T')[0];
            (0, response_helper_1.sendSuccess)(res, await room_service_1.roomService.getAvailable(date), 'Available rooms');
        }
        catch (err) {
            next(err);
        }
    },
    async bookRoom(req, res, next) {
        try {
            if (!req.user)
                throw new exceptions_1.UnauthorizedError();
            const meeting = await room_service_1.roomService.bookRoom({ ...req.body, bookedBy: req.user.userId });
            (0, response_helper_1.sendCreated)(res, meeting, 'Room booked');
        }
        catch (err) {
            next(err);
        }
    },
    async cancelBooking(req, res, next) {
        try {
            if (!req.user)
                throw new exceptions_1.UnauthorizedError();
            const meeting = await room_service_1.roomService.cancelBooking(req.params.id, req.user.userId);
            (0, response_helper_1.sendSuccess)(res, meeting, 'Booking cancelled');
        }
        catch (err) {
            next(err);
        }
    },
};
