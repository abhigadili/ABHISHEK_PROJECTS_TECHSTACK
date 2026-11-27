"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.paginationSchema = exports.updateCompanySchema = exports.createCompanySchema = void 0;
const joi_1 = __importDefault(require("joi"));
exports.createCompanySchema = joi_1.default.object({
    name: joi_1.default.string().min(2).max(100).required(),
    address: joi_1.default.string().required(),
    email: joi_1.default.string().email().required(),
    phone: joi_1.default.string().min(7).max(20).required(),
    description: joi_1.default.string().max(500).optional(),
    website: joi_1.default.string().uri().optional(),
});
exports.updateCompanySchema = exports.createCompanySchema.fork(['name', 'address', 'email', 'phone'], field => field.optional());
exports.paginationSchema = joi_1.default.object({
    page: joi_1.default.number().integer().min(1).default(1),
    pageSize: joi_1.default.number().integer().min(1).max(100).default(10),
    sort: joi_1.default.string().optional(),
    order: joi_1.default.string().valid('asc', 'desc').default('asc'),
    search: joi_1.default.string().optional(),
});
