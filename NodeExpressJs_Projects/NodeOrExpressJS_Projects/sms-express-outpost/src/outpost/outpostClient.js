const axios = require("axios");
const env = require("../config/env");

const http = axios.create({
  baseURL: env.outpost.baseUrl,
  headers: {
    Authorization: `Bearer ${env.outpost.apiKey}`,
    "Content-Type": "application/json",
  },
  validateStatus: () => true,
});

async function call(method, url, { params, data } = {}) {
  const res = await http.request({ method, url, params, data });
  if (res.status >= 400) {
    const err = new Error(
      `Outpost ${method.toUpperCase()} ${url} failed: ${res.status} ${JSON.stringify(res.data)}`
    );
    err.status = res.status;
    err.body = res.data;
    throw err;
  }
  return res.data;
}

module.exports = {
  // Health & Config
  healthz: () => call("get", "/healthz"),
  getConfig: () => call("get", "/config"),
  updateConfig: (body) => call("patch", "/config", { data: body }),

  // Tenants
  listTenants: (query) => call("get", "/tenants", { params: query }),
  upsertTenant: (tenantId) => call("put", `/tenants/${tenantId}`),
  getTenant: (tenantId) => call("get", `/tenants/${tenantId}`),
  deleteTenant: (tenantId) => call("delete", `/tenants/${tenantId}`),

  // Portal & Tenant Auth
  getTenantPortalUrl: (tenantId) => call("get", `/tenants/${tenantId}/portal`),
  getTenantToken: (tenantId) => call("get", `/tenants/${tenantId}/token`),

  // Destinations
  listDestinations: (tenantId) => call("get", `/tenants/${tenantId}/destinations`),
  createDestination: (tenantId, body) =>
    call("post", `/tenants/${tenantId}/destinations`, { data: body }),
  getDestination: (tenantId, destinationId) =>
    call("get", `/tenants/${tenantId}/destinations/${destinationId}`),
  updateDestination: (tenantId, destinationId, body) =>
    call("patch", `/tenants/${tenantId}/destinations/${destinationId}`, { data: body }),
  deleteDestination: (tenantId, destinationId) =>
    call("delete", `/tenants/${tenantId}/destinations/${destinationId}`),
  enableDestination: (tenantId, destinationId) =>
    call("put", `/tenants/${tenantId}/destinations/${destinationId}/enable`),
  disableDestination: (tenantId, destinationId) =>
    call("put", `/tenants/${tenantId}/destinations/${destinationId}/disable`),

  // Events
  listEvents: (query) => call("get", "/events", { params: query }),
  getEvent: (eventId) => call("get", `/events/${eventId}`),

  // Attempts
  listAttempts: (query) => call("get", "/attempts", { params: query }),
  getAttempt: (attemptId) => call("get", `/attempts/${attemptId}`),
  listDestinationAttempts: (tenantId, destinationId, query) =>
    call("get", `/tenants/${tenantId}/destinations/${destinationId}/attempts`, { params: query }),
  getDestinationAttempt: (tenantId, destinationId, attemptId) =>
    call("get", `/tenants/${tenantId}/destinations/${destinationId}/attempts/${attemptId}`),

  // Publish & Retry
  publishEvent: ({ id, tenantId, topic, data, metadata, eligibleForRetry }) =>
    call("post", "/publish", {
      data: {
        id,
        tenant_id: tenantId,
        topic,
        data,
        ...(metadata ? { metadata } : {}),
        ...(eligibleForRetry !== undefined ? { eligible_for_retry: eligibleForRetry } : {}),
      },
    }),
  retryEvent: ({ eventId, destinationId }) =>
    call("post", "/retry", { data: { event_id: eventId, destination_id: destinationId } }),

  // Destination Types & Topics
  listDestinationTypes: () => call("get", "/destination-types"),
  getDestinationType: (type) => call("get", `/destination-types/${type}`),
  listTopics: () => call("get", "/topics"),

  // Metrics
  getEventMetrics: (query) => call("get", "/metrics/events", { params: query }),
  getAttemptMetrics: (query) => call("get", "/metrics/attempts", { params: query }),
};
