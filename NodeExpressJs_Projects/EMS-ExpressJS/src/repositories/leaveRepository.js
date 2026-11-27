const { query } = require('../config/database');
const { fromSqlUtc } = require('../utils/dates');

// ---------- types & policies ----------
const TYPE = `SELECT lt.id, lt.code, lt.name, lt.description, lt.is_paid AS isPaid, lt.requires_document AS requiresDocument, lt.is_active AS isActive,
  lp.annual_entitlement AS annualEntitlement, lp.carry_forward_max AS carryForwardMax, lp.allow_half_day AS allowHalfDay, lp.max_consecutive_days AS maxConsecutiveDays
  FROM leave_types lt LEFT JOIN leave_policies lp ON lp.leave_type_id = lt.id`;
const normType = (r) => r && ({
  id: r.id, code: r.code, name: r.name, description: r.description, isPaid: !!r.isPaid, requiresDocument: !!r.requiresDocument, isActive: !!r.isActive,
  policy: r.annualEntitlement === null ? null : { annualEntitlement: Number(r.annualEntitlement), carryForwardMax: Number(r.carryForwardMax), allowHalfDay: !!r.allowHalfDay, maxConsecutiveDays: r.maxConsecutiveDays },
});
const listTypes = async (activeOnly) => (await query(`${TYPE} ${activeOnly ? 'WHERE lt.is_active = 1' : ''} ORDER BY lt.id`)).map(normType);
const getType = async (id, conn) => normType((await query(`${TYPE} WHERE lt.id = ?`, [id], conn))[0]);
const insertType = async (t) => (await query('INSERT INTO leave_types (code, name, description, is_paid, requires_document) VALUES (?,?,?,?,?)',
  [t.code, t.name, t.description || null, t.isPaid === false ? 0 : 1, t.requiresDocument ? 1 : 0])).insertId;
async function updateType(id, t) {
  const m = { name: 'name', description: 'description', isPaid: 'is_paid', requiresDocument: 'requires_document', isActive: 'is_active' };
  const k = Object.keys(m).filter((x) => t[x] !== undefined);
  if (k.length) await query(`UPDATE leave_types SET ${k.map((x) => `${m[x]} = ?`).join(', ')} WHERE id = ?`, [...k.map((x) => (typeof t[x] === 'boolean' ? +t[x] : t[x])), id]);
}
const upsertPolicy = (typeId, p) => query(
  `INSERT INTO leave_policies (leave_type_id, annual_entitlement, carry_forward_max, allow_half_day, max_consecutive_days) VALUES (?,?,?,?,?)
   ON DUPLICATE KEY UPDATE annual_entitlement = VALUES(annual_entitlement), carry_forward_max = VALUES(carry_forward_max),
     allow_half_day = VALUES(allow_half_day), max_consecutive_days = VALUES(max_consecutive_days)`,
  [typeId, p.annualEntitlement, p.carryForwardMax || 0, p.allowHalfDay === false ? 0 : 1, p.maxConsecutiveDays || null]);
const removePolicy = (typeId) => query('DELETE FROM leave_policies WHERE leave_type_id = ?', [typeId]);

// ---------- balances ----------
const activePolicies = (conn) => query(
  'SELECT lp.* FROM leave_policies lp JOIN leave_types lt ON lt.id = lp.leave_type_id WHERE lt.is_active = 1', [], conn);

/** Create missing balance rows for the year from policy (+carry-forward), recording each in the ledger. Idempotent. */
async function ensureBalances(employeeId, year, conn) {
  for (const p of await activePolicies(conn)) {
    const r = await query('INSERT IGNORE INTO leave_balances (employee_id, leave_type_id, year, entitled) VALUES (?,?,?,?)', [employeeId, p.leave_type_id, year, p.annual_entitlement], conn);
    if (r.affectedRows !== 1) continue;
    const bal = r.insertId;
    await query('INSERT INTO leave_balance_transactions (leave_balance_id, type, amount, note) VALUES (?,?,?,?)', [bal, 'ENTITLEMENT', p.annual_entitlement, `Annual entitlement ${year}`], conn);
    if (Number(p.carry_forward_max) > 0) {
      const prev = (await query('SELECT entitled + adjusted - used AS avail FROM leave_balances WHERE employee_id = ? AND leave_type_id = ? AND year = ?', [employeeId, p.leave_type_id, year - 1], conn))[0];
      const carry = prev ? Math.min(Number(prev.avail), Number(p.carry_forward_max)) : 0;
      if (carry > 0) {
        await query('UPDATE leave_balances SET adjusted = adjusted + ? WHERE id = ?', [carry, bal], conn);
        await query('INSERT INTO leave_balance_transactions (leave_balance_id, type, amount, note) VALUES (?,?,?,?)', [bal, 'ADJUSTMENT', carry, `Carry-forward from ${year - 1}`], conn);
      }
    }
  }
}
const lockBalance = async (employeeId, typeId, year, conn) =>
  (await query('SELECT id, entitled, adjusted, used FROM leave_balances WHERE employee_id = ? AND leave_type_id = ? AND year = ? FOR UPDATE', [employeeId, typeId, year], conn))[0];
const listBalances = (employeeId, year) => query(
  `SELECT leave_type_id AS leaveTypeId, leave_type_code AS leaveTypeCode, leave_type_name AS leaveTypeName, year, entitled, adjusted, used, available
   FROM v_leave_balance_available WHERE employee_id = ? AND year = ? ORDER BY leave_type_id`, [employeeId, year]);
const pendingDays = async (employeeId, typeId, year, conn) => Number((await query(
  "SELECT COALESCE(SUM(days),0) d FROM leave_requests WHERE employee_id = ? AND leave_type_id = ? AND status = 'PENDING' AND YEAR(start_date) = ?", [employeeId, typeId, year], conn))[0].d);
const applyBalanceDelta = (balanceId, { usedDelta = 0, adjustedDelta = 0 }, conn) =>
  query('UPDATE leave_balances SET used = used + ?, adjusted = adjusted + ? WHERE id = ?', [usedDelta, adjustedDelta, balanceId], conn);
const insertTx = (t, conn) => query('INSERT INTO leave_balance_transactions (leave_balance_id, leave_request_id, type, amount, note, created_by) VALUES (?,?,?,?,?,?)',
  [t.balanceId, t.requestId || null, t.type, t.amount, t.note || null, t.createdBy || null], conn);
const listTx = (employeeId, year) => query(
  `SELECT t.id, t.type, t.amount, t.note, t.leave_request_id AS leaveRequestId, t.created_at AS createdAt, lt.code AS leaveTypeCode
   FROM leave_balance_transactions t JOIN leave_balances b ON b.id = t.leave_balance_id JOIN leave_types lt ON lt.id = b.leave_type_id
   WHERE b.employee_id = ? AND b.year = ? ORDER BY t.id DESC`, [employeeId, year]);

// ---------- requests ----------
const REQ = `SELECT r.*, lt.code AS type_code, lt.name AS type_name, e.employee_code, CONCAT(e.first_name,' ',e.last_name) AS employee_name,
    e.manager_id AS employee_manager_id, e.department_id, e.work_location,
    (SELECT COUNT(*) FROM leave_request_documents d WHERE d.leave_request_id = r.id) AS document_count
  FROM leave_requests r JOIN leave_types lt ON lt.id = r.leave_type_id JOIN employees e ON e.id = r.employee_id`;
const toDto = (r) => r && ({
  id: r.id, employeeId: r.employee_id, employeeCode: r.employee_code, employeeName: r.employee_name,
  leaveType: { id: r.leave_type_id, code: r.type_code, name: r.type_name }, startDate: r.start_date, endDate: r.end_date, dayPart: r.day_part,
  days: Number(r.days), reason: r.reason, status: r.status, decidedBy: r.decided_by, decidedAt: fromSqlUtc(r.decided_at), decisionNote: r.decision_note,
  cancelledAt: fromSqlUtc(r.cancelled_at), documentCount: Number(r.document_count), createdAt: r.created_at,
});
const findRaw = async (id, conn) => {
  if (conn) await query('SELECT id FROM leave_requests WHERE id = ? FOR UPDATE', [id], conn); // lock only the request row
  return (await query(`${REQ} WHERE r.id = ?`, [id], conn))[0];
};
const findById = async (id) => toDto(await findRaw(id));

const insertRequest = async (r, conn) => (await query(
  'INSERT INTO leave_requests (employee_id, leave_type_id, start_date, end_date, day_part, days, reason) VALUES (?,?,?,?,?,?,?)',
  [r.employeeId, r.leaveTypeId, r.startDate, r.endDate, r.dayPart, r.days, r.reason], conn)).insertId;
const overlapping = (employeeId, start, end, conn) => query(
  "SELECT id, start_date, end_date, day_part FROM leave_requests WHERE employee_id = ? AND status IN ('PENDING','APPROVED') AND start_date <= ? AND end_date >= ?", [employeeId, end, start], conn);
const setStatus = (id, cols, conn) => {
  const k = Object.keys(cols);
  return query(`UPDATE leave_requests SET ${k.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`, [...k.map((c) => cols[c]), id], conn);
};

async function list({ employeeIds, statuses, from, to, leaveTypeId, managerId, departmentId, limit, offset, noPaging }) {
  const w = []; const p = [];
  if (employeeIds) { w.push('r.employee_id IN (?)'); p.push(employeeIds.length ? employeeIds : [0]); }
  if (statuses) { w.push('r.status IN (?)'); p.push(statuses); }
  if (from) { w.push('r.end_date >= ?'); p.push(from); }
  if (to) { w.push('r.start_date <= ?'); p.push(to); }
  if (leaveTypeId) { w.push('r.leave_type_id = ?'); p.push(leaveTypeId); }
  if (managerId) { w.push('e.manager_id = ?'); p.push(managerId); }
  if (departmentId) { w.push('e.department_id = ?'); p.push(departmentId); }
  const where = w.length ? `WHERE ${w.join(' AND ')}` : '';
  const total = (await query(`SELECT COUNT(*) c FROM leave_requests r JOIN employees e ON e.id = r.employee_id ${where}`, p))[0].c;
  const rows = await query(`${REQ} ${where} ORDER BY r.start_date DESC, r.id DESC ${noPaging ? '' : 'LIMIT ? OFFSET ?'}`, noPaging ? p : [...p, limit, offset]);
  return { items: rows.map(toDto), total };
}

// ---------- documents ----------
const insertDocument = async (requestId, f) => (await query('INSERT INTO leave_request_documents (leave_request_id, file_name, mime_type, size_bytes, data) VALUES (?,?,?,?,?)',
  [requestId, f.originalname.slice(0, 255), f.detectedType, f.size, f.buffer])).insertId;
const listDocuments = (requestId) => query('SELECT id, file_name AS fileName, mime_type AS mimeType, size_bytes AS sizeBytes, created_at AS createdAt FROM leave_request_documents WHERE leave_request_id = ?', [requestId]);
const getDocument = async (requestId, docId) => (await query('SELECT file_name, mime_type, size_bytes, data FROM leave_request_documents WHERE leave_request_id = ? AND id = ?', [requestId, docId]))[0];
const documentCount = async (requestId, conn) => (await query('SELECT COUNT(*) c FROM leave_request_documents WHERE leave_request_id = ?', [requestId], conn))[0].c;

// ---------- attendance integration ----------
const markOnLeave = (employeeId, dates, conn) => Promise.all(dates.map((d) => query(
  "INSERT IGNORE INTO attendance (employee_id, work_date, status, work_mode, remarks) VALUES (?,?,'ON_LEAVE','OFFICE','Approved leave')", [employeeId, d], conn)));
const clearOnLeave = (employeeId, start, end, conn) => query(
  "DELETE FROM attendance WHERE employee_id = ? AND work_date BETWEEN ? AND ? AND status = 'ON_LEAVE' AND check_in_at IS NULL", [employeeId, start, end], conn);

module.exports = {
  listTypes, getType, insertType, updateType, upsertPolicy, removePolicy, ensureBalances, lockBalance, listBalances, pendingDays, applyBalanceDelta,
  insertTx, listTx, findRaw, findById, insertRequest, overlapping, setStatus, list, insertDocument, listDocuments, getDocument, documentCount, markOnLeave, clearOnLeave, toDto,
};
