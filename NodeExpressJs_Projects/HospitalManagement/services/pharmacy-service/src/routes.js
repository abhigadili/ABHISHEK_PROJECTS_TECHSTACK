import { ROLES } from '@hms/shared/constants';
import { idParams, rxParams, medicineBody, restockBody, rejectBody, ordersQuery } from './schemas.js';

const { ADMIN, DOCTOR, PHARMACIST } = ROLES;

export function registerRoutes(api, svc) {
  api.get('/api/pharmacy/medicines', { summary: 'Inventory', roles: [ADMIN, PHARMACIST, DOCTOR] }, async (req, res) => res.json(await svc.listMedicines()));
  api.post('/api/pharmacy/medicines', { summary: 'Add medicine', roles: [ADMIN, PHARMACIST], body: medicineBody }, async (req, res) => res.status(201).json(await svc.addMedicine(req.valid.body)));
  api.put('/api/pharmacy/medicines/:id', { summary: 'Update medicine', roles: [ADMIN, PHARMACIST], params: idParams, body: medicineBody }, async (req, res) => res.json(await svc.updateMedicine(req.valid.params.id, req.valid.body)));
  api.post('/api/pharmacy/medicines/:id/restock', { summary: 'Restock (row-locked)', roles: [ADMIN, PHARMACIST], params: idParams, body: restockBody }, async (req, res) => res.json(await svc.restock(req.valid.params.id, req.valid.body.quantity)));
  api.get('/api/pharmacy/orders', { summary: 'Orders', roles: [ADMIN, PHARMACIST], query: ordersQuery }, async (req, res) => res.json(await svc.orders(req.valid.query)));
  api.get('/api/pharmacy/orders/prescription/:prescriptionId', { summary: 'Order of a prescription', roles: [ADMIN, PHARMACIST, DOCTOR], params: rxParams }, async (req, res) => res.json(await svc.orderByPrescription(req.valid.params.prescriptionId)));
  api.get('/api/pharmacy/orders/:id', { summary: 'Order details', roles: [ADMIN, PHARMACIST], params: idParams }, async (req, res) => res.json(await svc.order(req.valid.params.id)));
  api.post('/api/pharmacy/orders/:id/dispense', { summary: 'Dispense (verifies the prescription over HTTP, locks stock, publishes MedicineDispensed)', roles: [ADMIN, PHARMACIST], params: idParams }, async (req, res) => res.json(await svc.dispense(req.valid.params.id, req.user)));
  api.post('/api/pharmacy/orders/:id/reject', { summary: 'Reject an order', roles: [ADMIN, PHARMACIST], params: idParams, body: rejectBody }, async (req, res) => res.json(await svc.reject(req.valid.params.id, req.valid.body.reason)));
}
