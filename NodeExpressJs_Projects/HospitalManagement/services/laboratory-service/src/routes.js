import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { ROLES } from '@hms/shared/constants';
import { BadRequestError } from '@hms/shared/utils';
import { idParams, patientParams, testBody, requestBody, statusBody, reportBody, queueQuery } from './schemas.js';

const { ADMIN, DOCTOR, PATIENT, LAB_STAFF } = ROLES;
const ALLOWED = { 'application/pdf': '.pdf', 'image/png': '.png', 'image/jpeg': '.jpg' };

export function registerRoutes(api, svc, { uploadDir }) {
  // Multer: report attachments (PDF / PNG / JPEG, max 5 MB) are stored under a random name; only metadata goes to MySQL
  const dir = path.join(uploadDir, 'lab');
  fs.mkdirSync(dir, { recursive: true });
  const upload = multer({
    storage: multer.diskStorage({ destination: dir, filename: (req, file, cb) => cb(null, randomUUID() + (ALLOWED[file.mimetype] ?? '')) }),
    limits: { fileSize: 5 * 1024 * 1024, files: 1 },
    fileFilter: (req, file, cb) => (ALLOWED[file.mimetype] ? cb(null, true) : cb(new BadRequestError('Only PDF, PNG or JPEG files are accepted'))),
  });

  api.get('/api/lab/tests', { summary: 'Test catalogue' }, async (req, res) => res.json(await svc.catalogue()));
  api.post('/api/lab/tests', { summary: 'Add a test to the catalogue', roles: [ADMIN, LAB_STAFF], body: testBody }, async (req, res) => res.status(201).json(await svc.addTest(req.valid.body)));
  api.post('/api/lab/requests', { summary: 'Request a lab test (publishes LabTestRequested)', roles: [ADMIN, DOCTOR], body: requestBody }, async (req, res) => res.status(201).json(await svc.request(req.valid.body, req.user)));
  api.get('/api/lab/requests', { summary: 'Work queue (priority ordered)', roles: [ADMIN, DOCTOR, LAB_STAFF], query: queueQuery }, async (req, res) => res.json(await svc.queue(req.valid.query)));
  api.get('/api/lab/requests/patient/:patientId', { summary: 'Requests of a patient', params: patientParams }, async (req, res) => res.json(await svc.forPatient(req.valid.params.patientId, req.user)));
  api.get('/api/lab/requests/:id', { summary: 'Request details', params: idParams }, async (req, res) => res.json(await svc.get(req.valid.params.id, req.user)));
  api.put('/api/lab/requests/:id/status', { summary: 'Update status (SAMPLE_COLLECTED, IN_PROGRESS, CANCELLED)', roles: [ADMIN, LAB_STAFF], params: idParams, body: statusBody }, async (req, res) => res.json(await svc.updateStatus(req.valid.params.id, req.valid.body.status)));
  api.put('/api/lab/requests/:id/cancel', { summary: 'Cancel a request', roles: [ADMIN, DOCTOR, LAB_STAFF], params: idParams }, async (req, res) => res.json(await svc.cancel(req.valid.params.id)));
  api.post('/api/lab/requests/:id/report', { summary: 'Submit the report (publishes LabReportGenerated)', roles: [ADMIN, LAB_STAFF], params: idParams, body: reportBody }, async (req, res) => res.status(201).json(await svc.submitReport(req.valid.params.id, req.valid.body, req.user)));
  api.get('/api/lab/requests/:id/report', { summary: 'Retrieve the report (doctors, staff, the owning patient)', params: idParams }, async (req, res) => res.json(await svc.report(req.valid.params.id, req.user)));
  api.post('/api/lab/requests/:id/report/attachment', { summary: "Upload a report attachment (multipart field 'file')", roles: [ADMIN, LAB_STAFF], params: idParams }, upload.single('file'),
    async (req, res) => res.status(201).json(await svc.attach(req.valid.params.id, req.file)));
  api.get('/api/lab/requests/:id/report/attachment', { summary: 'Download the report attachment', params: idParams }, async (req, res) => {
    const a = await svc.attachment(req.valid.params.id, req.user);
    res.setHeader('content-type', a.mime);
    res.download(path.join(dir, a.path), a.name);
  });
}
