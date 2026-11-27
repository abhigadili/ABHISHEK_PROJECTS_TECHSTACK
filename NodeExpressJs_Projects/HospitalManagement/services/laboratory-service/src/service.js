import { stageEvent } from '@hms/shared/kafka';
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError, hasRole, isAdmin, pageOf, toNum } from '@hms/shared/utils';

const TRANSITIONS = { REQUESTED: ['SAMPLE_COLLECTED', 'CANCELLED'], SAMPLE_COLLECTED: ['IN_PROGRESS', 'CANCELLED'], IN_PROGRESS: ['CANCELLED'] };
const PRIORITY_RANK = { STAT: 3, URGENT: 2, ROUTINE: 1 };

const toTest = (t) => ({ id: t.id, code: t.code, name: t.name, sampleType: t.sampleType, price: toNum(t.price), turnaroundHours: t.turnaroundHours });
const toRequest = (r) => ({ id: r.id, patientId: r.patientId, patientName: r.patientName, doctorId: r.doctorId, appointmentId: r.appointmentId, testCode: r.test?.code, testName: r.testName, price: toNum(r.price),
  priority: r.priority, status: r.status, clinicalNotes: r.clinicalNotes, accessionNumber: r.accessionNumber, requestedAt: r.requestedAt });
const toReport = (r, req) => ({ id: r.id, requestId: r.requestId, patientId: req.patientId, testName: req.testName, resultSummary: r.resultSummary, resultDetails: r.resultDetails, referenceRange: r.referenceRange,
  abnormal: r.abnormal, reportedBy: r.reportedBy, reportedAt: r.reportedAt, attachment: r.attachmentName ? { name: r.attachmentName, mimeType: r.attachmentMime, sizeBytes: r.attachmentSize } : null });

export function createLabService({ prisma, logger, patients, doctors }) {
  const find = async (id) => (await prisma.labRequest.findUnique({ where: { id }, include: { test: true } })) ?? (() => { throw new NotFoundError(`Lab request ${id} not found`); })();
  const guard = async (patientId, user) => { if (hasRole(user, 'PATIENT')) await patients.requireAccess(patientId, user); };

  const catalogue = async () => (await prisma.labTest.findMany({ where: { active: true }, orderBy: { name: 'asc' } })).map(toTest);
  async function addTest(b) {
    const code = b.code.trim().toUpperCase();
    if (await prisma.labTest.findUnique({ where: { code } })) throw new ConflictError(`Test code '${code}' already exists`);
    return toTest(await prisma.labTest.create({ data: { code, name: b.name, sampleType: b.sampleType ?? null, price: b.price, turnaroundHours: b.turnaroundHours ?? null } }));
  }

  // ---- Scenario 4
  async function request(b, user) {
    const patient = await patients.get(b.patientId);                 // gRPC
    const doctor = await doctors.get(b.doctorId);                    // gRPC
    if (!doctor.active) throw new BadRequestError(`Doctor ${doctor.id} is not active`);
    if (!isAdmin(user) && (!doctor.userId || doctor.userId !== user.id)) throw new ForbiddenError('A doctor can only request tests in their own name');
    const test = await prisma.labTest.findUnique({ where: { code: b.testCode.trim().toUpperCase() } });
    if (!test || !test.active) throw new BadRequestError(`Unknown or inactive lab test '${b.testCode}'`);
    const r = await prisma.$transaction(async (tx) => {
      const created = await tx.labRequest.create({ data: { patientId: patient.id, patientName: patient.fullName, patientEmail: patient.email, doctorId: doctor.id, appointmentId: b.appointmentId ?? null,
        testId: test.id, testName: test.name, price: test.price, priority: b.priority ?? 'ROUTINE', clinicalNotes: b.clinicalNotes ?? null }, include: { test: true } });
      await stageEvent(tx, 'LabTestRequested', created.id, { requestId: created.id, patientId: created.patientId, patientName: created.patientName, patientEmail: created.patientEmail,
        doctorId: created.doctorId, testCode: test.code, testName: test.name, price: toNum(created.price), priority: created.priority });
      return created;
    });
    logger.info({ requestId: r.id, test: test.code, patientId: r.patientId }, 'Lab request created');
    return toRequest(r);
  }
  async function updateStatus(id, target) {
    const r = await find(id);
    if (target === 'COMPLETED') throw new BadRequestError('A request becomes COMPLETED only when its report is submitted');
    if (!(TRANSITIONS[r.status] ?? []).includes(target)) throw new ConflictError(`Invalid status change ${r.status} -> ${target}`);
    return toRequest(await prisma.labRequest.update({ where: { id }, data: { status: target }, include: { test: true } }));
  }
  async function cancel(id) {
    const r = await find(id);
    if (!['REQUESTED', 'SAMPLE_COLLECTED'].includes(r.status)) throw new ConflictError(`Only REQUESTED or SAMPLE_COLLECTED requests can be cancelled (current: ${r.status})`);
    return toRequest(await prisma.labRequest.update({ where: { id }, data: { status: 'CANCELLED' }, include: { test: true } }));
  }
  async function submitReport(id, b, user) {
    const r = await find(id);
    if (r.status !== 'IN_PROGRESS') throw new ConflictError(`A report can only be submitted for IN_PROGRESS requests (current: ${r.status})`);
    if (await prisma.labReport.findUnique({ where: { requestId: id } })) throw new ConflictError('A report already exists for this request');
    const rep = await prisma.$transaction(async (tx) => {
      const created = await tx.labReport.create({ data: { requestId: id, resultSummary: b.resultSummary, resultDetails: b.resultDetails ?? null, referenceRange: b.referenceRange ?? null, abnormal: b.abnormal, reportedBy: user?.username ?? 'system' } });
      await tx.labRequest.update({ where: { id }, data: { status: 'COMPLETED' } });
      await stageEvent(tx, 'LabReportGenerated', created.id, { reportId: created.id, requestId: id, patientId: r.patientId, patientName: r.patientName, patientEmail: r.patientEmail, doctorId: r.doctorId,
        testName: r.testName, summary: created.resultSummary, abnormal: created.abnormal });
      return created;
    });
    logger.info({ reportId: rep.id, requestId: id }, 'Lab report generated');
    return toReport(rep, r);
  }
  async function attach(id, file) {
    const r = await find(id);
    const rep = await prisma.labReport.findUnique({ where: { requestId: id } });
    if (!rep) throw new ConflictError('Submit the report before attaching a file');
    if (!file) throw new BadRequestError("A file is required (multipart field 'file': PDF, PNG or JPEG, max 5 MB)");
    const upd = await prisma.labReport.update({ where: { id: rep.id }, data: { attachmentName: file.originalname.slice(0, 200), attachmentPath: file.filename, attachmentMime: file.mimetype, attachmentSize: file.size } });
    logger.info({ requestId: id, sizeBytes: file.size }, 'Lab report attachment stored');
    return toReport(upd, r);
  }
  async function attachment(id, user) {
    const r = await find(id);
    await guard(r.patientId, user);
    const rep = await prisma.labReport.findUnique({ where: { requestId: id } });
    if (!rep?.attachmentPath) throw new NotFoundError('No attachment for this report');
    return { path: rep.attachmentPath, name: rep.attachmentName, mime: rep.attachmentMime };
  }

  // ---- reads
  async function get(id, user) { const r = await find(id); await guard(r.patientId, user); return toRequest(r); }
  async function report(id, user) {
    const r = await find(id);
    await guard(r.patientId, user);
    const rep = await prisma.labReport.findUnique({ where: { requestId: id } });
    if (!rep) throw new NotFoundError(`No report available yet for request ${id} (status ${r.status})`);
    return toReport(rep, r);
  }
  async function forPatient(patientId, user) {
    await patients.requireAccess(patientId, user);
    return (await prisma.labRequest.findMany({ where: { patientId }, include: { test: true }, orderBy: { requestedAt: 'desc' } })).map(toRequest);
  }
  async function queue({ status, page, size }) {
    const where = status ? { status } : {};
    const [rows, total] = await Promise.all([prisma.labRequest.findMany({ where, include: { test: true }, orderBy: { requestedAt: 'asc' }, skip: page * size, take: size }), prisma.labRequest.count({ where })]);
    rows.sort((a, b) => (PRIORITY_RANK[b.priority] ?? 0) - (PRIORITY_RANK[a.priority] ?? 0));
    return pageOf(rows.map(toRequest), page, size, total);
  }

  /** Consumer of LabTestRequested: puts the request in the lab work queue by assigning an accession number (inside the consumer's transaction). */
  async function enqueue(tx, requestId) {
    const r = await tx.labRequest.findUnique({ where: { id: requestId } });
    if (!r || r.accessionNumber) return;
    const d = new Date();
    const acc = `LAB-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}-${String(r.id).padStart(6, '0')}`;
    await tx.labRequest.update({ where: { id: requestId }, data: { accessionNumber: acc, queuedAt: new Date() } });
    logger.info({ requestId, accession: acc }, 'Lab request queued');
  }

  async function seedCatalogue() {
    if (await prisma.labTest.count()) return;
    await prisma.labTest.createMany({ data: [
      { code: 'CBC', name: 'Complete Blood Count', sampleType: 'Blood', price: 350, turnaroundHours: 6 }, { code: 'LIPID', name: 'Lipid Profile', sampleType: 'Blood', price: 600, turnaroundHours: 12 },
      { code: 'HBA1C', name: 'HbA1c (Glycated Hemoglobin)', sampleType: 'Blood', price: 550, turnaroundHours: 12 }, { code: 'TSH', name: 'Thyroid Stimulating Hormone', sampleType: 'Blood', price: 450, turnaroundHours: 12 },
      { code: 'UA', name: 'Urine Analysis', sampleType: 'Urine', price: 200, turnaroundHours: 4 }, { code: 'LFT', name: 'Liver Function Test', sampleType: 'Blood', price: 700, turnaroundHours: 12 } ] });
    logger.info('Seeded 6 lab tests');
  }
  return { catalogue, addTest, request, updateStatus, cancel, submitReport, attach, attachment, get, report, forPatient, queue, enqueue, seedCatalogue };
}
