const router = require('express').Router();
const swaggerUi = require('swagger-ui-express');
const { build } = require('./openapi');

router.get('/openapi.json', (req, res) => res.json(build()));
router.use('/', swaggerUi.serve, swaggerUi.setup(build(), { customSiteTitle: 'EMS-ExpressJS API' }));
module.exports = router;
