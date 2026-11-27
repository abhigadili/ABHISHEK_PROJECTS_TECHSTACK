// Thin passthrough over every endpoint Outpost itself exposes, so the
// full feature set (tenants, portal, destinations, events, attempts,
// publish/retry, destination-types/topics, metrics) is reachable through
// this service's own API rather than requiring direct calls to Outpost.
const express = require("express");
const asyncHandler = require("../middleware/asyncHandler");
const outpostClient = require("../outpost/outpostClient");

const router = express.Router();
const ok = (fn) => asyncHandler(async (req, res) => res.json(await fn(req)));

// Health & Config
router.get("/healthz", ok(() => outpostClient.healthz()));
router.get("/config", ok(() => outpostClient.getConfig()));
router.patch("/config", ok((req) => outpostClient.updateConfig(req.body)));

// Tenants
router.get("/tenants", ok((req) => outpostClient.listTenants(req.query)));
router.put("/tenants/:tenantId", ok((req) => outpostClient.upsertTenant(req.params.tenantId)));
router.get("/tenants/:tenantId", ok((req) => outpostClient.getTenant(req.params.tenantId)));
router.delete("/tenants/:tenantId", ok((req) => outpostClient.deleteTenant(req.params.tenantId)));

// Portal & Tenant Auth
router.get("/tenants/:tenantId/portal", ok((req) => outpostClient.getTenantPortalUrl(req.params.tenantId)));
router.get("/tenants/:tenantId/token", ok((req) => outpostClient.getTenantToken(req.params.tenantId)));

// Destinations
router.get(
  "/tenants/:tenantId/destinations",
  ok((req) => outpostClient.listDestinations(req.params.tenantId))
);
router.post(
  "/tenants/:tenantId/destinations",
  ok((req) => outpostClient.createDestination(req.params.tenantId, req.body))
);
router.get(
  "/tenants/:tenantId/destinations/:destinationId",
  ok((req) => outpostClient.getDestination(req.params.tenantId, req.params.destinationId))
);
router.patch(
  "/tenants/:tenantId/destinations/:destinationId",
  ok((req) => outpostClient.updateDestination(req.params.tenantId, req.params.destinationId, req.body))
);
router.delete(
  "/tenants/:tenantId/destinations/:destinationId",
  ok((req) => outpostClient.deleteDestination(req.params.tenantId, req.params.destinationId))
);
router.put(
  "/tenants/:tenantId/destinations/:destinationId/enable",
  ok((req) => outpostClient.enableDestination(req.params.tenantId, req.params.destinationId))
);
router.put(
  "/tenants/:tenantId/destinations/:destinationId/disable",
  ok((req) => outpostClient.disableDestination(req.params.tenantId, req.params.destinationId))
);

// Events
router.get("/events", ok((req) => outpostClient.listEvents(req.query)));
router.get("/events/:eventId", ok((req) => outpostClient.getEvent(req.params.eventId)));

// Attempts
router.get("/attempts", ok((req) => outpostClient.listAttempts(req.query)));
router.get("/attempts/:attemptId", ok((req) => outpostClient.getAttempt(req.params.attemptId)));
router.get(
  "/tenants/:tenantId/destinations/:destinationId/attempts",
  ok((req) => outpostClient.listDestinationAttempts(req.params.tenantId, req.params.destinationId, req.query))
);
router.get(
  "/tenants/:tenantId/destinations/:destinationId/attempts/:attemptId",
  ok((req) =>
    outpostClient.getDestinationAttempt(req.params.tenantId, req.params.destinationId, req.params.attemptId)
  )
);

// Publish & Retry
router.post(
  "/publish",
  ok((req) =>
    outpostClient.publishEvent({
      id: req.body.id,
      tenantId: req.body.tenant_id,
      topic: req.body.topic,
      data: req.body.data,
      metadata: req.body.metadata,
      eligibleForRetry: req.body.eligible_for_retry,
    })
  )
);
router.post(
  "/retry",
  ok((req) => outpostClient.retryEvent({ eventId: req.body.event_id, destinationId: req.body.destination_id }))
);

// Destination Types & Topics
router.get("/destination-types", ok(() => outpostClient.listDestinationTypes()));
router.get("/destination-types/:type", ok((req) => outpostClient.getDestinationType(req.params.type)));
router.get("/topics", ok(() => outpostClient.listTopics()));

// Metrics
router.get("/metrics/events", ok((req) => outpostClient.getEventMetrics(req.query)));
router.get("/metrics/attempts", ok((req) => outpostClient.getAttemptMetrics(req.query)));

module.exports = router;
