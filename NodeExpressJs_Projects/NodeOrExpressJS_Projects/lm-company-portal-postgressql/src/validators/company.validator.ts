import Joi from 'joi';

export const createCompanySchema = Joi.object({
  name:        Joi.string().min(2).max(100).required(),
  address:     Joi.string().required(),
  email:       Joi.string().email().required(),
  phone:       Joi.string().min(7).max(20).required(),
  description: Joi.string().max(500).optional(),
  website:     Joi.string().uri().optional(),
});

export const updateCompanySchema = createCompanySchema.fork(
  ['name','address','email','phone'],
  field => field.optional()
);

export const paginationSchema = Joi.object({
  page:     Joi.number().integer().min(1).default(1),
  pageSize: Joi.number().integer().min(1).max(100).default(10),
  sort:     Joi.string().optional(),
  order:    Joi.string().valid('asc','desc').default('asc'),
  search:   Joi.string().optional(),
});
