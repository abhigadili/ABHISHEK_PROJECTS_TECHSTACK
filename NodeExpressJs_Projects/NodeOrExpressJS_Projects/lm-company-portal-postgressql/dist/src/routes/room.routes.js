"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const room_controller_1 = require("../controllers/room.controller");
const authenticate_middleware_1 = require("../middlewares/authenticate.middleware");
const authorize_middleware_1 = require("../middlewares/authorize.middleware");
const constants_1 = require("../constants");
const router = (0, express_1.Router)();
router.use(authenticate_middleware_1.authenticate);
// Meeting room routes
router.get('/meeting-rooms/available', room_controller_1.roomController.getAvailable);
router.post('/meeting-rooms/book', room_controller_1.roomController.bookRoom);
router.delete('/meeting-rooms/cancel/:id', room_controller_1.roomController.cancelBooking);
// Room CRUD
router.get('/', room_controller_1.roomController.getAll);
router.get('/:id', room_controller_1.roomController.getById);
router.post('/', (0, authorize_middleware_1.authorize)([constants_1.ROLES.ADMIN, constants_1.ROLES.SUPER_ADMIN]), room_controller_1.roomController.create);
router.put('/:id', (0, authorize_middleware_1.authorize)([constants_1.ROLES.ADMIN, constants_1.ROLES.SUPER_ADMIN]), room_controller_1.roomController.update);
router.delete('/:id', (0, authorize_middleware_1.authorize)([constants_1.ROLES.SUPER_ADMIN]), room_controller_1.roomController.delete);
exports.default = router;
