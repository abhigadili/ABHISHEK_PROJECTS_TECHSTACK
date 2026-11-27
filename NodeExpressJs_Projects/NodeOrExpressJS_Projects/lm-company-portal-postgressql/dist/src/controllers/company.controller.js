"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.companyController = void 0;
const company_service_1 = require("../services/company.service");
const response_helper_1 = require("../utils/response.helper");
exports.companyController = {
    async getAll(req, res, next) {
        try {
            const { page = 1, pageSize = 10, search, sort, order } = req.query;
            const result = await company_service_1.companyService.getAll({ page: +page, pageSize: +pageSize, search, sort, order });
            (0, response_helper_1.sendSuccess)(res, result.companies, 'Companies fetched', 200, result.meta);
        }
        catch (err) {
            next(err);
        }
    },
    async getById(req, res, next) {
        try {
            const company = await company_service_1.companyService.getById(req.params.id);
            (0, response_helper_1.sendSuccess)(res, company);
        }
        catch (err) {
            next(err);
        }
    },
    async create(req, res, next) {
        try {
            const company = await company_service_1.companyService.create(req.body);
            (0, response_helper_1.sendCreated)(res, company, 'Company created');
        }
        catch (err) {
            next(err);
        }
    },
    async update(req, res, next) {
        try {
            const company = await company_service_1.companyService.update(req.params.id, req.body);
            (0, response_helper_1.sendSuccess)(res, company, 'Company updated');
        }
        catch (err) {
            next(err);
        }
    },
    async patch(req, res, next) {
        try {
            const company = await company_service_1.companyService.patch(req.params.id, req.body);
            (0, response_helper_1.sendSuccess)(res, company, 'Company patched');
        }
        catch (err) {
            next(err);
        }
    },
    async delete(req, res, next) {
        try {
            await company_service_1.companyService.delete(req.params.id);
            (0, response_helper_1.sendSuccess)(res, null, 'Company deactivated');
        }
        catch (err) {
            next(err);
        }
    },
};
