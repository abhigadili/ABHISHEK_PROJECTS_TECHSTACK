"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.departmentController = void 0;
const department_service_1 = require("../services/department.service");
const response_helper_1 = require("../utils/response.helper");
exports.departmentController = {
    async getAll(req, res, next) {
        try {
            const { page = 1, pageSize = 10 } = req.query;
            const result = await department_service_1.departmentService.getAll(+page, +pageSize);
            (0, response_helper_1.sendSuccess)(res, result.departments, 'Departments fetched', 200, result.meta);
        }
        catch (err) {
            next(err);
        }
    },
    async getById(req, res, next) {
        try {
            (0, response_helper_1.sendSuccess)(res, await department_service_1.departmentService.getById(req.params.id));
        }
        catch (err) {
            next(err);
        }
    },
    async create(req, res, next) {
        try {
            (0, response_helper_1.sendCreated)(res, await department_service_1.departmentService.create(req.body), 'Department created');
        }
        catch (err) {
            next(err);
        }
    },
    async update(req, res, next) {
        try {
            (0, response_helper_1.sendSuccess)(res, await department_service_1.departmentService.update(req.params.id, req.body), 'Department updated');
        }
        catch (err) {
            next(err);
        }
    },
    async delete(req, res, next) {
        try {
            await department_service_1.departmentService.delete(req.params.id);
            (0, response_helper_1.sendSuccess)(res, null, 'Department deleted');
        }
        catch (err) {
            next(err);
        }
    },
};
