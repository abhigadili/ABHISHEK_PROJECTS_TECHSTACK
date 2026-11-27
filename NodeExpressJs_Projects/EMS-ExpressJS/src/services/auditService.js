const auditRepo = require('../repositories/auditRepository');
const logger = require('../utils/logger');

/** Records a sensitive action. Never throws: auditing must not break the business operation. */
async function log(req, action, entityType, entityId, details, conn) {
  try {
    await auditRepo.insert({
      userId: req.user && req.user.id, action, entityType, entityId, details,
      ip: req.ip, requestId: req.id,
    }, conn);
  } catch (e) {
    logger.error('audit.failed', { action, error: e.message });
  }
}
module.exports = { log };
