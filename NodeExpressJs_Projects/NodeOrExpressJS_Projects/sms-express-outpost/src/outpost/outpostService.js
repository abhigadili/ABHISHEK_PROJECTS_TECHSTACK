const crypto = require("crypto");
const outpostClient = require("./outpostClient");

// Idempotent: PUT /tenants/{id} no-ops if the tenant already exists.
// Every domain event publish ensures the tenant first so a department's
// destinations/webhooks can always be attached before or after any event.
async function ensureTenant(tenantId) {
  return outpostClient.upsertTenant(tenantId);
}

async function publish(tenantId, topic, data) {
  await ensureTenant(tenantId);
  return outpostClient.publishEvent({
    id: crypto.randomUUID(),
    tenantId,
    topic,
    data,
  });
}

module.exports = { ensureTenant, publish };
