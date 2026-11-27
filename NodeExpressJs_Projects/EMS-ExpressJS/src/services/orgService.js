const orgRepo = require('../repositories/orgRepository');
const empRepo = require('../repositories/employeeRepository');
const ApiError = require('../utils/ApiError');

const node = (r) => ({
  id: r.id, employeeCode: r.employeeCode, name: `${r.firstName} ${r.lastName}`, workEmail: r.workEmail,
  designation: r.designation, jobTitle: r.jobTitle, department: r.departmentId ? { id: r.departmentId, name: r.department } : null,
  managerId: r.managerId, profilePictureUrl: r.hasPicture ? `/api/v1/employees/${r.id}/picture` : null,
  directReportCount: 0, subordinates: [],
});

/** Assemble nested JSON from flat depth-ordered rows. */
function assemble(rows, { departmentId } = {}) {
  const byId = new Map(rows.map((r) => [r.id, node(r)]));
  const roots = [];
  for (const r of rows) {
    const n = byId.get(r.id);
    const parent = r.managerId && byId.get(r.managerId);
    if (parent && r.depth > 0) { parent.subordinates.push(n); parent.directReportCount += 1; } else roots.push(n);
  }
  if (!departmentId) return roots;
  // department scope: keep nodes in the department plus the path needed to connect them
  const keep = (n) => { n.subordinates = n.subordinates.filter(keep); return (n.department && n.department.id === departmentId) || n.subordinates.length > 0; };
  return roots.filter(keep);
}

async function hierarchy({ rootId, depth, departmentId }) {
  if (rootId && !(await empRepo.findBrief(rootId))) throw ApiError.notFound('Employee not found');
  const rows = await orgRepo.treeRows({ rootId, maxDepth: depth, departmentId });
  const tree = assemble(rows, { departmentId });
  const result = { roots: tree, totalNodes: rows.length };
  if (!rootId) {
    // Legacy-data safety: active employees that no root can reach (e.g. a reporting cycle) are reported, not looped over.
    const all = await empRepo.search({ status: 'ACTIVE' }, { orderBy: 'e.id', limit: 100000, offset: 0 });
    const seen = new Set(rows.map((r) => r.id));
    const unreachable = all.rows.filter((e) => !seen.has(e.id)).map((e) => ({ id: e.id, employeeCode: e.employee_code, managerId: e.manager_id }));
    if (unreachable.length) result.warnings = { unreachableEmployees: unreachable, reason: 'Not reachable from any top-level employee (possible reporting cycle)' };
  }
  return result;
}

async function directReports(managerId) {
  if (!(await empRepo.findBrief(managerId))) throw ApiError.notFound('Employee not found');
  return (await orgRepo.directReports(managerId)).map((r) => ({ ...node(r), directReportCount: r.directReportCount }));
}

async function reportingChain(employeeId) {
  const emp = await empRepo.findBrief(employeeId);
  if (!emp) throw ApiError.notFound('Employee not found');
  const ids = await orgRepo.ancestorIds(employeeId);
  const nodes = new Map((await orgRepo.nodesByIds([employeeId, ...ids])).map((r) => [r.id, node(r)]));
  const strip = ({ subordinates, directReportCount, ...rest }) => rest;
  return { employee: strip(nodes.get(employeeId)), chain: ids.map((id, i) => ({ level: i + 1, ...strip(nodes.get(id)) })) };
}

async function search(q, { rootId } = {}) {
  let ids;
  if (rootId) ids = [rootId, ...(await orgRepo.descendantIds(rootId))];
  else ids = (await empRepo.search({ status: 'ACTIVE' }, { orderBy: 'e.id', limit: 100000, offset: 0 })).rows.map((r) => r.id);
  const rows = await orgRepo.searchInTree(ids, q);
  const out = [];
  for (const r of rows) {
    const chain = await orgRepo.ancestorIds(r.id);
    out.push({ ...(({ subordinates, directReportCount, ...x }) => x)(node(r)), depth: chain.length, managerChainIds: chain });
  }
  return out;
}

module.exports = { hierarchy, directReports, reportingChain, search };
