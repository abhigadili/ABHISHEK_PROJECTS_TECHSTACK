"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.employeeController = void 0;
const employee_service_1 = require("../services/employee.service");
const response_helper_1 = require("../utils/response.helper");
exports.employeeController = {
    async getAll(req, res, next) {
        try {
            const { page = 1, pageSize = 10 } = req.query;
            const result = await employee_service_1.employeeService.getAll(+page, +pageSize);
            (0, response_helper_1.sendSuccess)(res, result.employees, 'Employees fetched', 200, result.meta);
        }
        catch (err) {
            next(err);
        }
    },
    async getById(req, res, next) {
        try {
            (0, response_helper_1.sendSuccess)(res, await employee_service_1.employeeService.getById(req.params.id));
        }
        catch (err) {
            next(err);
        }
    },
    async create(req, res, next) {
        try {
            (0, response_helper_1.sendCreated)(res, await employee_service_1.employeeService.create(req.body), 'Employee created');
        }
        catch (err) {
            next(err);
        }
    },
    async update(req, res, next) {
        try {
            (0, response_helper_1.sendSuccess)(res, await employee_service_1.employeeService.update(req.params.id, req.body), 'Employee updated');
        }
        catch (err) {
            next(err);
        }
    },
    async delete(req, res, next) {
        try {
            await employee_service_1.employeeService.delete(req.params.id);
            (0, response_helper_1.sendSuccess)(res, null, 'Employee deleted');
        }
        catch (err) {
            next(err);
        }
    },
};
