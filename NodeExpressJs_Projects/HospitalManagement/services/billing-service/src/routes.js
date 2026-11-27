import { ROLES } from '@hms/shared/constants';
import { idParams, patientParams, refParams, billBody, paymentBody, paymentStatusBody, listQuery } from './schemas.js';

const { ADMIN, PATIENT, BILLING_STAFF } = ROLES;

export function registerRoutes(api, svc) {
  api.post('/api/bills', { summary: 'Raise a manual bill (APPOINTMENT bills verified over HTTP)', roles: [ADMIN, BILLING_STAFF], body: billBody }, async (req, res) => res.status(201).json(await svc.createManual(req.valid.body)));
  api.get('/api/bills', { summary: 'List bills', roles: [ADMIN, BILLING_STAFF], query: listQuery }, async (req, res) => res.json(await svc.list(req.valid.query)));
  api.get('/api/bills/patient/:patientId', { summary: 'Bills of a patient', roles: [ADMIN, BILLING_STAFF, PATIENT], params: patientParams }, async (req, res) => res.json(await svc.forPatient(req.valid.params.patientId, req.user)));
  api.get('/api/bills/:id', { summary: 'Bill details', roles: [ADMIN, BILLING_STAFF, PATIENT], params: idParams }, async (req, res) => res.json(await svc.get(req.valid.params.id, req.user)));
  api.put('/api/bills/:id/cancel', { summary: 'Cancel an unpaid bill', roles: [ADMIN, BILLING_STAFF], params: idParams }, async (req, res) => res.json(await svc.cancel(req.valid.params.id)));
  api.post('/api/bills/:id/payments', { summary: 'Initiate a payment (PENDING + transaction reference)', roles: [ADMIN, BILLING_STAFF, PATIENT], params: idParams, body: paymentBody }, async (req, res) => res.status(201).json(await svc.initiatePayment(req.valid.params.id, req.valid.body, req.user)));
  api.get('/api/bills/:id/payments', { summary: 'Payments of a bill', roles: [ADMIN, BILLING_STAFF, PATIENT], params: idParams }, async (req, res) => res.json(await svc.paymentsOf(req.valid.params.id, req.user)));
  api.get('/api/payments/:reference', { summary: 'Payment by transaction reference', roles: [ADMIN, BILLING_STAFF, PATIENT], params: refParams }, async (req, res) => res.json(await svc.payment(req.valid.params.reference, req.user)));
  api.put('/api/payments/:reference/status', { summary: 'Simulated gateway callback / confirmation of cash & insurance', roles: [ADMIN, BILLING_STAFF], params: refParams, body: paymentStatusBody }, async (req, res) => res.json(await svc.updatePaymentStatus(req.valid.params.reference, req.valid.body)));
}
