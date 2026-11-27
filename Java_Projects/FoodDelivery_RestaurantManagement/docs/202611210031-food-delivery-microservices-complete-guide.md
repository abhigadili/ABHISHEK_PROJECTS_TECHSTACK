# Food Delivery & Restaurant Management: Complete Guide

*A beginner-friendly walkthrough of a real microservices system: what it does, how to run it, how every pattern is implemented
and **exactly which file** contains it. Every code excerpt below is copied live from the repository by `scripts/gen_guide.py`;
every Kafka table is generated from the running system by `scripts/gen_kafka_docs.py`.*

---

## 1. What you have built

A food-delivery platform with five kinds of users:

| User | What they do |
|---|---|
| **Customer** | searches restaurants, builds a cart, applies coupons, pays (sandbox), tracks the order, cancels, gets refunds, reviews |
| **Restaurant owner** | registers a restaurant, manages hours / menu / stock, accepts or rejects orders, cooks, sees sales and reviews |
| **Delivery partner** | goes online, receives delivery offers, accepts, picks up, delivers, sees performance |
| **Admin / Super admin** | approves restaurants, manages users, coupons, review moderation, watches orders / payments / refunds, **monitors Kafka and logs** |
| *(the system)* | reacts to events: notifications, stock movement, refunds, ratings, search indexing |

It is built as **15 independent Spring Boot applications** (plus an API gateway and a service registry) that talk to each other
over REST (synchronously) and Kafka (asynchronously), each owning its own MySQL database.

```
                        ┌────────────────────────── Angular 19 (port 4500) ──────────────────────────┐
                        │ customer · restaurant owner · delivery partner · admin · Kafka monitor · logs│
                        └───────────────────────────────────┬─────────────────────────────────────────┘
                                                            │ HTTPS/JSON  (only the gateway is public)
                                              ┌─────────────▼─────────────┐
                                              │  API Gateway  :9080        │  JWT check · rate limit · circuit breaker
                                              │  (Spring Cloud Gateway)    │  CORS · correlation id · fallback
                                              └─────────────┬─────────────┘
                       lb://service-name  (Eureka :9761)    │
   ┌────────┬────────┬────────┬────────┬────────┬───────────┴┬────────┬────────┬────────┬────────┬────────┐
   │ user   │customer│restaur.│ menu   │ cart   │   order    │payment │delivery│notific.│ review │ coupon │ ... inventory, search,
   │ 9101   │ 9102   │ 9103   │ 9104   │ 9105   │   9106     │ 9107   │ 9108   │ 9109   │ 9110   │ 9111   │ admin, event-audit
   └───┬────┴───┬────┴───┬────┴───┬────┴───┬────┴─────┬──────┴───┬────┴───┬────┴───┬────┴───┬────┴───┬────┘
       │ each service: own Spring Boot app · own port · own MySQL database · own Flyway migrations
       ▼                                           │ events (Kafka :9392, transactional outbox)      │ cache / deny-list (Redis :6390)
   MySQL :3306  (15 databases)                     ▼                                                 ▼
                                      event-audit-service ──► MySQL audit store ──► Angular "Kafka monitoring"
   Log4j2 JSON files ──► Logstash ──► Elasticsearch :9400 ──► Kibana :5601  and  Angular "Logging" (via event-audit-service)
```

### Technology stack

| Area | Choice (and why) |
|---|---|
| Language / runtime | Java **21** (current LTS that Spring Boot 3.4 supports) |
| Framework | Spring Boot **3.4.5**, Spring Cloud **2024.0.1** (the BOM-aligned pair: no version mixing), Spring MVC on embedded Tomcat, **Jakarta** Servlet 6 |
| Persistence | MySQL 8, Spring Data JPA / Hibernate 6.6, **Flyway** migrations, `ddl-auto: validate` |
| Sync communication | **OpenFeign** (declarative) and **WebClient** (non-blocking composition), both through Eureka |
| Async communication | **Apache Kafka** (KRaft), transactional outbox, idempotent consumers, DLT |
| Cache | **Redis** via Spring Cache (`@Cacheable`…), JWT deny-list, gateway rate limiter |
| Resilience | **Resilience4j**: circuit breaker, retry, bulkhead, rate limiter, time limiter |
| Logging | **Log4j2** (Logback excluded) → JSON → **Logstash → Elasticsearch → Kibana** |
| Tracing | Micrometer Tracing (Brave) + our own correlation id (also inside Kafka events) |
| API docs | springdoc OpenAPI / Swagger UI (per service and aggregated at the gateway) |
| Frontend | **Angular 19**, standalone components, signals, lazy routes, Angular Material |
| Build | Maven multi-module (parent POM + 18 modules); `mvn clean install` builds everything |

---

## 2. How to run it

**Prerequisites:** Java 21, Maven 3.8+, Node 20 (Angular 19), Docker, the MySQL server on `localhost:3306`.
The MySQL login and a generated JWT secret live in the git-ignored `.env`; **no credentials are in the Java source**.

```bash
cd ~/Documents/PROJECTS_TECKSTACK/Java_Projects/FoodDelivery_RestaurantManagement
scripts/create-databases.sh                 # 15 databases (database-per-service)
scripts/build.sh                            # mvn clean install (jars + Flyway baselines)
scripts/start-all.sh                        # docker: Kafka, Redis, Elasticsearch, Logstash, Kibana; then Eureka, 15 services, gateway
infrastructure/kibana/setup-kibana.sh       # Kibana data view + the "Food Delivery - Operations" dashboard
cd frontend && npm install && npm start     # Angular on http://localhost:4500 (proxy -> gateway :9080)
python3 scripts/e2e.py                      # live end-to-end verification through the gateway
scripts/status.sh                           # health of every service
scripts/stop-all.sh                         # stops Java processes by port (add --infra to stop containers)
```

| What | URL |
|---|---|
| Application | http://localhost:4500 |
| All APIs (Swagger, aggregated) | http://localhost:9080/swagger-ui.html (each service also at `:91xx/swagger-ui.html`) |
| Service registry | http://localhost:9761 |
| Kibana dashboard | http://localhost:5601/app/dashboards#/view/fd-dashboard |

**Logins:** administrator `admin@fooddelivery.com` (username `superadmin`) with the password in `.env`
(`BOOTSTRAP_ADMIN_PASSWORD`). Customers, restaurant owners and delivery partners register themselves on `/register`.

**Sandbox payments.** No real payment provider is configured, so the *payment provider abstraction* uses a clearly labelled
`SANDBOX` adapter: every payment shows "SANDBOX: no real money moved". On checkout you choose the outcome:
*succeeds*, *declined*, or *succeeds but the later refund fails*. This is how every failure path is demonstrable.

**Startup order matters only for infrastructure:** Eureka first, then services in any order (they retry), gateway last.
`start-all.sh` does this in waves of five JVMs (fifteen JVMs booting at once is slower on a laptop than three waves).

---

## 3. The services and who owns what

| Service | Port | Database | Own Maven module |
|---|---|---|---|
| `admin-service` | 9114 | `food_admin_db` | `admin-service/pom.xml` |
| `cart-service` | 9105 | `food_cart_db` | `cart-service/pom.xml` |
| `coupon-service` | 9111 | `food_coupon_db` | `coupon-service/pom.xml` |
| `customer-service` | 9102 | `food_customer_db` | `customer-service/pom.xml` |
| `delivery-service` | 9108 | `food_delivery_db` | `delivery-service/pom.xml` |
| `event-audit-service` | 9115 | `food_event_audit_db` | `event-audit-service/pom.xml` |
| `inventory-service` | 9112 | `food_inventory_db` | `inventory-service/pom.xml` |
| `menu-service` | 9104 | `food_menu_db` | `menu-service/pom.xml` |
| `notification-service` | 9109 | `food_notification_db` | `notification-service/pom.xml` |
| `order-service` | 9106 | `food_order_db` | `order-service/pom.xml` |
| `payment-service` | 9107 | `food_payment_db` | `payment-service/pom.xml` |
| `restaurant-service` | 9103 | `food_restaurant_db` | `restaurant-service/pom.xml` |
| `review-service` | 9110 | `food_review_db` | `review-service/pom.xml` |
| `search-service` | 9113 | `food_search_db` | `search-service/pom.xml` |
| `user-service` | 9101 | `food_user_db` | `user-service/pom.xml` |

Plus `api-gateway` (9080) and `service-discovery` (9761), which have no database.

**Database-per-service, enforced:** every module has its own entities, repositories and Flyway migrations
(`<service>/src/main/resources/db/migration/V1__init.sql`). Nobody queries another service's database; where one service needs
another's data it either **calls its API** (customer address, restaurant info, menu prices) or **keeps its own read model
built from events** (the restaurant's order inbox, the search index, the review service's list of delivered orders).
There are no cross-database foreign keys.

**What lives in `common/` (and what does not):** only *technical* building blocks: JWT/security, outbox + consumer support,
Redis cache config, Feign/WebClient config, Log4j2 config, file storage, AOP, standard error handling. **No domain entities.**
The event payload records in `Events.java` are *messages*, not entities, so sharing them does not couple the databases.

| Service | Responsibility | Talks synchronously to | Kafka topics it produces | Kafka topics it consumes |
|---|---|---|---|---|
| user | accounts, JWT, refresh/logout, password flows, roles & permissions | – | `user.registered`, `notification.requested` | – |
| customer | profile, addresses, preferences, activity, order history | order (Feign) | – | `user.registered`, `order.created`, `order.status.updated` |
| restaurant | profile, hours, approval, search, ratings, order inbox + sales | – | `restaurant.registered`, `restaurant.approved` | `order.confirmed`, `order.status.updated`, `review.created` |
| menu | categories, items, variants, add-ons, price validation, popularity | restaurant (Feign) | `menu.item.created`, `menu.item.updated` | `order.confirmed` |
| cart | one-restaurant cart, server-side pricing | menu (WebClient), restaurant + coupon (Feign) | – | `order.created` |
| order | place order, state machine, saga participant | cart, coupon, inventory (Feign); customer, restaurant, menu (WebClient) | `order.created/confirmed/cancelled/rejected/status.updated` | `payment.*`, `refund.*`, `inventory.reservation-failed`, `delivery.picked-up/completed` |
| payment | payments, refunds, webhook, timeout watchdog | order (Feign) | `payment.initiated/success/failed`, `refund.initiated/completed` | `order.created/cancelled/rejected` |
| delivery | partners, assignment, offer expiry, delivery workflow | order (WebClient) | `delivery.assigned/accepted/picked-up/completed` | `user.registered`, `order.status.updated`, `review.created` |
| notification | in-app / sandbox e-mail / sandbox SMS | user (Feign) | – | 16 topics |
| review | eligibility, ratings, moderation, aggregates | – | `review.created` | `order.confirmed`, `delivery.completed` |
| coupon | coupons, campaigns, validation, redemptions | – | `coupon.redeemed` | `order.confirmed` |
| inventory | ingredients, recipes, stock movements, alerts | restaurant (Feign) | `inventory.updated`, `inventory.low-stock`, `inventory.reservation-failed` | `order.confirmed/cancelled/rejected` |
| search | restaurant / food / cuisine / offer search | coupon (WebClient) | – | `restaurant.approved`, `menu.item.*`, `review.created` |
| admin | dashboard aggregation, system config, activity feed | 7 services (WebClient) | – | 7 topics |
| event-audit | event audit store, Kafka monitor, log search, health | Elasticsearch, Kafka AdminClient | – | every business topic + `audit.*` |

(The exact, generated producer/consumer classes are in section 7.)

### When to call synchronously and when to use Kafka

* **Synchronous (Feign / WebClient)** when the caller **needs the answer right now to continue** and can fail the user's request:
  placing an order needs the customer's address, the restaurant's open/closed state, authoritative menu prices, a coupon verdict
  and a stock pre-check. A read like that is cheap to retry and cheap to fail.
* **Kafka** when something **happened** and others should *react on their own schedule*: the order was paid → notify, consume
  stock, record the coupon, show the restaurant a new order. The producer neither knows nor waits for the consumers, so a slow or
  broken notification service can never fail a payment.

---

## 4. The order lifecycle and the Saga

An order is **not** one database transaction: it touches the order, payment, inventory, delivery and notification services, each with
its own database. There is no distributed transaction. Instead each service does its own *local* transaction and announces the result
as an event; the others react. That style is a **Saga (choreography)**, with a **compensating action** for every failure.

### The state machine

The status of an order can only move along the edges below. The browser never sets a status: it asks for an *action*
(`accept`, `cancel`…) and the backend decides whether the transition is legal.

```
CREATED ─► PAYMENT_PENDING ─► CONFIRMED ─► RESTAURANT_ACCEPTED ─► PREPARING ─► READY_FOR_PICKUP
                │  │              │  │            │  │                              │
                │  │              │  └─► REJECTED ◄┘  │                              ▼
                │  └─► PAYMENT_FAILED   └─────► CANCELLED ◄──┘                    PICKED_UP ─► OUT_FOR_DELIVERY ─► DELIVERED
                └────────────────────────► CANCELLED
         REJECTED / CANCELLED (paid) ─► REFUND_PENDING ─► REFUNDED
```

{{code order-service/src/main/java/com/fooddelivery/order/domain/OrderStatus.java | public Set<OrderStatus> next\(\) | ^    }$ | java}}

Every change goes through **one gate**, which validates the edge, writes the history row and queues the event:

{{code order-service/src/main/java/com/fooddelivery/order/service/OrderStateMachine.java | public void transition | ^    }$ | java}}

### Placing an order (saga steps 1-3)

`OrderPlacementService` does all the *remote* work **before** opening a database transaction (so no DB connection is held
while waiting for the network), composes three WebClient calls in parallel, and then writes the order and the outbox row in
**one local transaction**:

```java
// order-service/src/main/java/com/fooddelivery/order/service/OrderPlacementService.java
var tuple = Mono.zip(lookups.address(user.userId(), req.addressId()), lookups.restaurant(rid), lookups.priceMenu(menuReq), lookups.customer(user.userId()))
        .block(Duration.ofSeconds(10));
var address = tuple.getT1();
var restaurant = tuple.getT2();
var priced = tuple.getT3();
var customer = tuple.getT4();
```

Two safety nets: the customer's **cart is only a selection**, never a price (the backend re-prices every line from menu-service
and recomputes discount, delivery fee and 5 % tax), and an optional **`Idempotency-Key`** header makes a double-clicked
"Place order" return the first order instead of creating a second one:

{{code order-service/src/main/java/com/fooddelivery/order/service/OrderPlacementService.java | if \(idempotencyKey != null | ^        }$ | java}}

### The happy path, event by event

| # | Who | Does | Publishes |
|---|---|---|---|
| 1 | order | saves order `PAYMENT_PENDING` | `order.created`, `order.status.updated` |
| 2 | payment | creates a `PENDING` payment (verifies the amount through Feign) | `payment.initiated` |
| 3 | customer | pays (SANDBOX) → payment `SUCCESS` | `payment.success` |
| 4 | order | `PAYMENT_PENDING → CONFIRMED` | `order.confirmed`, `order.status.updated` |
| 5 | inventory / coupon / restaurant / menu / review | consume stock · record redemption · add to order inbox · count popularity · remember dishes | `inventory.updated`, `coupon.redeemed` (+ `inventory.low-stock`) |
| 6 | restaurant owner | accept → prepare → ready (REST calls to order-service) | `order.status.updated` ×3 |
| 7 | delivery | sees `READY_FOR_PICKUP`, offers the job to the least-recently-used available partner | `delivery.assigned` |
| 8 | delivery partner | accepts · picks up · delivers | `delivery.accepted`, `delivery.picked-up`, `delivery.completed` |
| 9 | order | `PICKED_UP → OUT_FOR_DELIVERY`, then `DELIVERED` | `order.status.updated` |
| 10 | notification | tells the customer / owner / partner at each step | – |

The step-3/4 handler: only a `PAYMENT_PENDING` order may be confirmed, a late or duplicate payment event is logged and ignored:

{{code order-service/src/main/java/com/fooddelivery/order/service/OrderWorkflowService.java | public void onPaymentSuccess | ^    }$ | java}}

### Failure scenarios and their compensation

| Failure | What happens | Where |
|---|---|---|
| **Payment declined** | `payment.failed` → order `PAYMENT_FAILED`, customer notified; a failed payment cannot be re-paid | `PaymentService.applyOutcome`, `OrderWorkflowService.onPaymentFailed` |
| **Payment timeout** | a watchdog fails `PENDING` payments after 10 min → same as declined | `PaymentWatchdog`, `PaymentService.expireOverdue` |
| **Duplicate payment callback** | signed webhook (HMAC) + ledger of provider event ids: the 2nd delivery is acknowledged but not applied | `PaymentController.callback`, `PaymentService.callback` |
| **Duplicate "pay" click** | `Idempotency-Key` ledger returns the stored result, no 2nd charge | `PaymentService.pay` |
| **Restaurant rejects** | `REJECTED` → `order.rejected` → payment-service refunds → `REFUND_PENDING` → `REFUNDED` | `OrderWorkflowService.reject`, `PaymentService.onOrderVoided` |
| **Inventory shortage** | stock is consumed under a row lock; if short, nothing is deducted and `inventory.reservation-failed` makes the order `REJECTED` + refunded | `InventoryService.consumeForOrder`, `OrderWorkflowService.onReservationFailed` |
| **Customer cancels** | allowed until `PREPARING`; unpaid → payment `CANCELLED`; paid → refund; stock is returned | `OrderWorkflowService.cancel`, `InventoryService.returnForOrder` |
| **Refund fails** | refund `FAILED`, order stays `REFUND_PENDING`, admin sees it and retries (needs `PERM_REFUND_MANAGE`) | `RefundService`, `RefundWorker` |
| **No delivery partner / offer ignored** | job stays `UNASSIGNED`, a scheduler retries every 10 s; an unanswered offer expires after 2 min and moves to the next partner | `DeliveryService.sweep`, `AssignmentScheduler` |
| **Kafka consumer failure** | 3 retries with back-off 0.5 s/1 s/2 s, then the message goes to `<topic>.DLT`; invalid events skip the retries | `KafkaConfig.kafkaErrorHandler` |
| **Kafka down at publish time** | the event waits in the outbox table (`PENDING`) and is published when Kafka returns: never lost | `OutboxRelay` |

The inventory compensation in code. The pessimistic lock (`SELECT … FOR UPDATE`, in id order, so two orders can never deadlock or both take
the last portion) is the whole trick:

```java
// inventory-service/src/main/java/com/fooddelivery/inventory/repository/IngredientRepository.java
/** SELECT ... FOR UPDATE, ordered by id (consistent order = no deadlocks between concurrent orders). */
@Lock(LockModeType.PESSIMISTIC_WRITE)
@Query("select i from Ingredient i where i.id in :ids order by i.id")
List<Ingredient> lockAllByIds(Collection<Long> ids);
```
{{code inventory-service/src/main/java/com/fooddelivery/inventory/service/InventoryService.java | List<Ingredient> locked = ingredients.lockAllByIds\(needed | ^        }$ | java}}

(Manual stock edits use the opposite strategy, **optimistic locking**: `@Version` on `Ingredient` makes two concurrent edits fail with HTTP 409 instead of overwriting each other.)

---

## 5. Kafka: architecture, contracts, reliability

Kafka is the **backbone for everything that "happened"**. This section is the Kafka documentation the project promises; the
tables in section 7 are generated from the running cluster so they always describe what really exists.

### 5.1 Infrastructure

One KRaft broker (no ZooKeeper) from `infrastructure/docker-compose.yml`, published on **localhost:9392**:

```yaml
// infrastructure/docker-compose.yml
image: apache/kafka:3.9.0
container_name: food-kafka
ports:
  - "9392:9092"          # host listener (advertised as localhost:9392)
environment:
  KAFKA_NODE_ID: 1
  KAFKA_PROCESS_ROLES: broker,controller             # KRaft mode: no ZooKeeper
  KAFKA_LISTENERS: PLAINTEXT://:9092,CONTROLLER://:9093
  KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://localhost:9392
  KAFKA_CONTROLLER_LISTENER_NAMES: CONTROLLER
  KAFKA_LISTENER_SECURITY_PROTOCOL_MAP: CONTROLLER:PLAINTEXT,PLAINTEXT:PLAINTEXT
  KAFKA_CONTROLLER_QUORUM_VOTERS: 1@localhost:9093
  KAFKA_INTER_BROKER_LISTENER_NAME: PLAINTEXT
  KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: 1
  KAFKA_TRANSACTION_STATE_LOG_REPLICATION_FACTOR: 1
  KAFKA_TRANSACTION_STATE_LOG_MIN_ISR: 1
  KAFKA_GROUP_INITIAL_REBALANCE_DELAY_MS: 0
  KAFKA_AUTO_CREATE_TOPICS_ENABLE: "true"
  KAFKA_NUM_PARTITIONS: 3
  KAFKA_LOG_RETENTION_HOURS: 168                      # default retention policy: 7 days
```

Topics are created by the services themselves at startup (`KafkaAdmin.NewTopics`): **3 partitions**, replication factor **1**
(local), **7-day retention**; each business topic also gets a **`<topic>.DLT`** dead-letter topic (1 partition, 28 days):

```java
// common/src/main/java/com/fooddelivery/common/kafka/KafkaConfig.java
public KafkaAdmin.NewTopics foodTopics(@Value("${food.kafka.partitions:3}") int partitions,
                                       @Value("${food.kafka.replicas:1}") int replicas,
                                       @Value("${food.kafka.retention-ms:604800000}") long retentionMs) {
    List<NewTopic> topics = new ArrayList<>();
    for (String t : Topics.allBusinessTopics()) {
        topics.add(TopicBuilder.name(t).partitions(partitions).replicas(replicas)
                .config(TopicConfig.RETENTION_MS_CONFIG, String.valueOf(retentionMs)).build());
        topics.add(TopicBuilder.name(t + ".DLT").partitions(1).replicas(replicas)
                .config(TopicConfig.RETENTION_MS_CONFIG, String.valueOf(retentionMs * 4)).build());
    }
    topics.add(TopicBuilder.name(Topics.AUDIT_PROCESSING).partitions(partitions).replicas(replicas)
            .config(TopicConfig.RETENTION_MS_CONFIG, String.valueOf(retentionMs)).build());
    topics.add(TopicBuilder.name(Topics.AUDIT_TOPOLOGY).partitions(1).replicas(replicas)
            .config(TopicConfig.RETENTION_MS_CONFIG, String.valueOf(retentionMs)).build());
    return new KafkaAdmin.NewTopics(topics.toArray(NewTopic[]::new));
```

The topic catalogue (names, plus a one-line purpose each) is the constants class `Topics.java`; every topic in it is produced *and*
consumed somewhere: nothing is declared "for later".

### 5.2 The event contract

Every message is a JSON **envelope** with the common metadata, and a typed **payload** record. Payloads are plain Java `record`s
in `Events.java` (never Hibernate entities), one per business event:

```java
// common/src/main/java/com/fooddelivery/common/kafka/EventEnvelope.java
public record EventEnvelope(String eventId, String eventType, String eventVersion, Instant eventTimestamp,
                            String aggregateId, String correlationId, String producerService, JsonNode payload) {
```
{{code common/src/main/java/com/fooddelivery/common/kafka/Events.java | public record OrderCreated | items\) \{\} | java}}

* `eventId` (UUID) = idempotency key, `eventVersion` = contract version (consumers ignore unknown fields = **backward compatible**;
  a breaking change bumps the version and consumers reject versions they do not understand),
  `correlationId` = the id of the HTTP request that caused the event, `producerService`, `eventTimestamp`, `aggregateId`.
* **Message key** = the aggregate id: the **order id** for everything order-related (so *all events of one order land in one
  partition and are consumed in order*), the **restaurant id** for restaurant/review/inventory events, the user id for user events.
* **Headers:** `eventId`, `eventType`, `X-Correlation-Id` (plus Kafka's own tracing headers).

### 5.3 Producing: the transactional outbox

The classic bug: save the order, then publish to Kafka. If the process dies between the two, the order exists but nobody hears
about it. The cure: **write the event into an `outbox_events` table in the same database transaction as the business change**
(`Propagation.MANDATORY` forbids calling it outside a transaction), and let a separate relay ship it to Kafka:

```java
// common/src/main/java/com/fooddelivery/common/kafka/EventPublisher.java
@Transactional(propagation = Propagation.MANDATORY)
public EventEnvelope publish(String topic, String eventType, String aggregateId, String key, Object payload) {
    String eventId = UUID.randomUUID().toString();
    String correlationId = Correlation.currentOrNew();
    EventEnvelope env = new EventEnvelope(eventId, eventType, VERSION, Instant.now(), aggregateId, correlationId, service,
            mapper.valueToTree(payload));
    OutboxEvent row = new OutboxEvent();
    row.setId(eventId);
    row.setTopic(topic);
    row.setMsgKey(key);
    row.setEventType(eventType);
    row.setCorrelationId(correlationId);
    try {
        row.setEnvelopeJson(mapper.writeValueAsString(env));
    } catch (JsonProcessingException e) {
        throw new IllegalStateException("Cannot serialise event " + eventType, e);
    }
    outbox.save(row);
```

The relay locks pending rows (`FOR UPDATE SKIP LOCKED`, so several instances never double-send), sends them **in order with a
synchronous acknowledgement** (`acks=all`, idempotent producer), and only then marks them `PUBLISHED`. If Kafka is down the rows
just stay `PENDING`:

{{code common/src/main/java/com/fooddelivery/common/kafka/OutboxRelay.java | @Scheduled\(fixedDelayString | ^    }$ | java}}

Each service's producer class declares itself with `@EventProducer(topics = …)`, e.g. `OrderEventProducer`, `PaymentEventProducer`,
`DeliveryEventProducer`, `InventoryEventProducer`, `RestaurantEventProducer`, `MenuEventProducer`, `UserEventProducer`,
`CouponEventProducer`, `ReviewEventProducer`.

### 5.4 Consuming: validate, de-duplicate, handle, audit, retry, dead-letter

All consumers go through `EventConsumerSupport.handle(...)`. In **one database transaction** it (1) checks the idempotency
ledger `processed_events (eventId, consumerGroup)`, (2) runs the business handler, (3) records the event as processed. A failing
handler rolls the ledger row back, so the retry can succeed; a re-delivered event is detected and skipped.

```java
// common/src/main/java/com/fooddelivery/common/kafka/EventConsumerSupport.java
Boolean first = tx.execute(s -> {
    if (processed.existsByEventIdAndConsumerGroup(e.eventId(), group())) return false;
    processed.saveAndFlush(new ProcessedEvent(e.eventId(), group(), rec.topic()));
    handler.accept(e, payload);
    return true;
});
boolean ok = Boolean.TRUE.equals(first);
```

The envelope is **validated before it is trusted** (non-empty, parseable, has id/type/payload, supported version); an invalid
event raises `InvalidEventException`, which is configured as *non-retryable*. Business state is validated by the handlers
(for example `payment.success` for an order that is no longer `PAYMENT_PENDING` is logged and ignored).

**Retry and dead-letter strategy** (one shared bean for all services):

```java
// common/src/main/java/com/fooddelivery/common/kafka/KafkaConfig.java
DeadLetterPublishingRecoverer dlt = new DeadLetterPublishingRecoverer(template,
        (rec, ex) -> new TopicPartition(rec.topic() + ".DLT", -1));
ConsumerRecordRecoverer recoverer = (rec, ex) -> {
    log.error("Dead-lettering record topic={} partition={} offset={}: {}", rec.topic(), rec.partition(), rec.offset(), ex.getMessage());
    audit.send(new ProcessingAudit(header(rec, "eventId"), header(rec, "eventType"), rec.topic(), rec.partition(), rec.offset(),
            rec.key() == null ? null : rec.key().toString(), service, service + "-group", topology.consumerClassFor(rec.topic()),
            ProcessingAudit.DEAD_LETTERED, 0, 0, String.valueOf(ex.getCause() != null ? ex.getCause() : ex),
            Instant.now(), header(rec, "X-Correlation-Id"), false));
    dlt.accept(rec, ex);
};
ExponentialBackOffWithMaxRetries backOff = new ExponentialBackOffWithMaxRetries(3);
backOff.setInitialInterval(500);
backOff.setMultiplier(2.0);
backOff.setMaxInterval(4000);
DefaultErrorHandler handler = new DefaultErrorHandler(recoverer, backOff);
handler.addNotRetryableExceptions(InvalidEventException.class, DeserializationException.class);
return handler;
```

* transient failure → retried **3×** with exponential back-off (0.5 s, 1 s, 2 s), the partition waits (ordering is preserved);
* still failing, or invalid → record published to **`<topic>.DLT`** (with the exception in headers) **and** an audit record
  `DEAD_LETTERED` is emitted;
* consumer groups are named **`<service>-group`**, `auto-offset-reset=earliest`, manual-per-record acks (`AckMode.RECORD`),
  so an offset is committed only after the handler (and its DB transaction) succeeded.

### 5.5 Where the producer/consumer map comes from

Nothing about "who produces/consumes what" is hard-coded in the UI or the docs. A `BeanPostProcessor` reads the annotations of every
bean at startup (`@EventProducer` classes, `@KafkaListener` methods incl. their group id), and each service **announces** that
list on `audit.topology` once it is up:

```java
// common/src/main/java/com/fooddelivery/common/kafka/TopologyRegistry.java
public Object postProcessAfterInitialization(Object bean, String beanName) {
    Class<?> target = AopUtils.getTargetClass(bean);
    String service = env.getProperty("spring.application.name", "unknown");
    EventProducer producer = AnnotationUtils.findAnnotation(target, EventProducer.class);
    if (producer != null) {
        for (String t : producer.topics()) {
            entries.add(new TopologyEntry(service, "PRODUCER", t, null, target.getSimpleName(), null));
        }
    }
    ReflectionUtils.doWithMethods(target, (Method m) -> {
        KafkaListener kl = AnnotationUtils.findAnnotation(m, KafkaListener.class);
        if (kl == null) return;
        String group = env.resolvePlaceholders(kl.groupId());
        for (String raw : kl.topics()) {
            if (raw.startsWith("#{")) continue;      // SpEL-driven wildcard listeners (the audit sink) are not part of the business map
            entries.add(new TopologyEntry(service, "CONSUMER", env.resolvePlaceholders(raw), group, target.getSimpleName(), m.getName()));
        }
    });
    return bean;
```

### 5.6 Event ordering, idempotency, and what can go wrong

| Concern | Strategy |
|---|---|
| Ordering | same key → same partition → consumed in order per aggregate (all events of order *n*, all review aggregates of restaurant *r*) |
| Duplicates | at-least-once delivery + idempotent consumers (ledger) + idempotent producer (`enable.idempotence`) + natural keys (one payment per order, one refund per payment, one redemption per order) |
| Lost events | impossible while the DB commit succeeded: outbox |
| Poison message | validated, **not retried**, dead-lettered, visible in *Kafka → Failed & DLT* |
| Out-of-order across topics | handlers check the current state before acting (stale events are ignored, not applied) |
| Slow consumer | lag is visible per group/partition in *Kafka → Consumer groups* (real offsets from the broker) |
| Sensitive data | audit payloads are masked (passwords/tokens/cards/e-mail/phone/password-reset codes) before storage and before display |

### 5.7 Kafka monitoring and the event-audit mechanism

Kafka itself does not give you a permanent, searchable "who did what with message X" history. So the **event-audit-service**
persists one row per observation in MySQL (`event_audit`), with a documented choice of store (durable, filterable, joinable
with processing status long after topic retention expires):

* **PUBLISHED rows**: the audit service consumes every business topic and records topic, partition, offset, key, event id/type,
  producer service, timestamp, headers and the **masked** payload;
* **CONSUMED rows**: every consumer reports what it did (`audit.event-processing`): consumer service, **group**, **class**, status
  (`PROCESSED`, `DUPLICATE_IGNORED`, `FAILED`, `DEAD_LETTERED`, `REJECTED_INVALID`), attempts, duration, error, processing time.
  **Published ≠ consumed**: the UI shows both and never claims consumption from publication.

```java
// event-audit-service/src/main/java/com/fooddelivery/eventaudit/service/AuditIngestService.java
public void recordProcessing(ProcessingAudit p) {
    if (p.eventId() == null && p.topic() == null) return;
    String key = "C:" + (p.eventId() != null ? p.eventId() : p.topic() + "-" + p.partition() + "-" + p.offset()) + ":" + p.consumerGroup();
    EventAudit a = audits.findByDedupeKey(key).orElseGet(EventAudit::new);
    boolean isNew = a.getId() == null;
    a.setDedupeKey(key);
    a.setRole("CONSUMED");
    a.setEventId(p.eventId());
    a.setTopic(p.topic());
    a.setPartitionNo(p.partition());
    a.setOffsetNo(p.offset());
    a.setMsgKey(p.key());
    a.setEventType(p.eventType());
    a.setConsumerService(p.consumerService());
    a.setConsumerGroup(p.consumerGroup());
    a.setConsumerClass(p.consumerClass());
    // never downgrade a final state because of a late/out-of-order FAILED attempt report
    if (isNew || !isFinal(a.getStatus()) || isFinal(p.status())) a.setStatus(p.status());
    a.setAttempts(p.attempt() > 0 ? p.attempt() : a.getAttempts());
    a.setDurationMs(p.durationMs());
    a.setErrorDetails(trim(p.error(), 590));
    a.setProcessedAt(p.processedAt());
    a.setCorrelationId(p.correlationId());
    if (a.getEventTimestamp() == null) a.setEventTimestamp(p.processedAt());
    if (a.getPayloadMasked() == null && p.eventId() != null) {
        audits.findByEventIdOrderByIdAsc(p.eventId()).stream().filter(x -> "PUBLISHED".equals(x.getRole())).findFirst().ifPresent(pub -> {
            a.setPayloadMasked(pub.getPayloadMasked());
            a.setProducerService(pub.getProducerService());
            if (pub.getEventTimestamp() != null) a.setEventTimestamp(pub.getEventTimestamp());
        });
    }
    audits.save(a);
```

The Angular **Kafka monitoring** area (admin only; Angular never talks to Kafka) has: topics (real partitions, replication,
retention, producers, consumers, groups, message counts), topic detail with **messages read straight from the broker**
(offset, key, headers, formatted JSON, *copy payload*), **message history & audit** (search, topic/status/type/service/date filters,
pagination, detail incl. all related events of the same correlation id), **event flow** (producer → topic → consumer graph from the
announced topology), **consumer groups** (state, members, assignments, committed vs. log-end offsets, lag), **failed messages**,
**dead-letter topics**, a guarded **test publish**, and a guarded **replay**.

Deliberately **not** offered: deleting messages/topics or moving offsets. **Replay** re-publishes the *original* record (read back from
Kafka) with `x-replay=true`; it is safe because groups that already processed the event skip it (the ledger), it works only for `FAILED` /
`DEAD_LETTERED` rows, at most 3 times, never twice within 30 s, and requires the `KAFKA_REPLAY` permission (SUPER_ADMIN):

```java
// event-audit-service/src/main/java/com/fooddelivery/eventaudit/service/ReplayService.java
if (a.getReplayCount() >= maxReplays) throw new BusinessException(HttpStatus.CONFLICT, "REPLAY_LIMIT", "Replay limit (" + maxReplays + ") reached for this record");
if (a.getLastReplayAt() != null && a.getLastReplayAt().isAfter(Instant.now().minus(Duration.ofSeconds(30)))) {
    throw new BusinessException(HttpStatus.CONFLICT, "REPLAY_TOO_SOON", "This record was replayed less than 30 seconds ago; wait for the result");
```

---

## 6. Saga participants: the other reliability and consistency patterns

* **Eventual consistency by design.** After `payment.success` the order becomes `CONFIRMED` a moment later; the UI polls the order
  every 4 s and the status history shows the exact sequence.
* **Read models built from events** (CQRS-style, no cross-DB access): the restaurant's **order inbox** and sales summary
  (`InboxService`), the **search index** (`SearchService.onRestaurantEvent`), the review service's **eligible orders**,
  the delivery service's partner profiles (from `user.registered`).
* **Optimistic locking** (`@Version`) on orders, payments, refunds, carts, ingredients; **pessimistic locking** for stock and for
  choosing a delivery partner (`lockAvailable()`); **atomic counter** (`usedCount = usedCount + 1`) for coupon redemption.

---

## 7. The real Kafka catalogue (generated from the running cluster)

<!-- GENERATED by scripts/gen_kafka_docs.py from the running system. Do not edit by hand. -->

**Cluster:** `5L6g3nShT-eMCtK--X86sw` · brokers: 1 (KRaft, single node for local development) · default partitions 3 · replication factor 1 · retention 7 days (DLT topics 28 days)

### Topic catalogue (real broker metadata)

| Topic | Purpose | Partitions | RF | Retention | Producer (service / class) | Consumers (service / class) | Consumer groups |
|---|---|---|---|---|---|---|---|
| `audit.event-processing` | Technical: consumer processing results for the event audit | 3 | 1 | 7.0 d | - | `event-audit-service / AuditConsumers` | `event-audit-service-group` |
| `audit.topology` | Technical: producer/consumer map announced by services | 1 | 1 | 7.0 d | - | `event-audit-service / AuditConsumers` | `event-audit-service-group` |
| `coupon.redeemed` | A coupon was redeemed by a confirmed order | 3 | 1 | 7.0 d | `coupon-service / CouponEventProducer` | - | `event-audit-service-group` |
| `delivery.accepted` | The delivery partner accepted the delivery | 3 | 1 | 7.0 d | `delivery-service / DeliveryEventProducer` | `notification-service / NotificationEventConsumer` | `event-audit-service-group`<br>`notification-service-group` |
| `delivery.assigned` | A delivery partner was offered a delivery | 3 | 1 | 7.0 d | `delivery-service / DeliveryEventProducer` | `notification-service / NotificationEventConsumer` | `event-audit-service-group`<br>`notification-service-group` |
| `delivery.completed` | The food was delivered to the customer | 3 | 1 | 7.0 d | `delivery-service / DeliveryEventProducer` | `admin-service / AdminEventConsumer`<br>`order-service / OrderEventConsumer`<br>`review-service / ReviewEventConsumer` | `admin-service-group`<br>`event-audit-service-group`<br>`order-service-group`<br>`review-service-group` |
| `delivery.picked-up` | The delivery partner collected the food | 3 | 1 | 7.0 d | `delivery-service / DeliveryEventProducer` | `notification-service / NotificationEventConsumer`<br>`order-service / OrderEventConsumer` | `event-audit-service-group`<br>`notification-service-group`<br>`order-service-group` |
| `inventory.low-stock` | An ingredient fell to or below its alert threshold | 3 | 1 | 7.0 d | `inventory-service / InventoryEventProducer` | `admin-service / AdminEventConsumer`<br>`notification-service / NotificationEventConsumer` | `admin-service-group`<br>`event-audit-service-group`<br>`notification-service-group` |
| `inventory.reservation-failed` | Saga compensation trigger: confirmed order cannot be fulfilled (stock shortage) | 3 | 1 | 7.0 d | `inventory-service / InventoryEventProducer` | `order-service / OrderEventConsumer` | `event-audit-service-group`<br>`order-service-group` |
| `inventory.updated` | Stock of an ingredient changed | 3 | 1 | 7.0 d | `inventory-service / InventoryEventProducer` | - | `event-audit-service-group` |
| `menu.item.created` | A food item was added to a menu | 3 | 1 | 7.0 d | `menu-service / MenuEventProducer` | `search-service / SearchEventConsumer` | `event-audit-service-group`<br>`search-service-group` |
| `menu.item.updated` | A food item was changed, deactivated or re-priced | 3 | 1 | 7.0 d | `menu-service / MenuEventProducer` | `search-service / SearchEventConsumer` | - |
| `notification.requested` | Explicit request to notify a user (also used by the admin test-publish) | 3 | 1 | 7.0 d | `user-service / UserEventProducer` | `notification-service / NotificationEventConsumer` | `event-audit-service-group`<br>`notification-service-group` |
| `order.cancelled` | Order cancelled by customer/admin/system | 3 | 1 | 7.0 d | `order-service / OrderEventProducer` | `inventory-service / InventoryEventConsumer`<br>`notification-service / NotificationEventConsumer`<br>`payment-service / PaymentEventConsumer` | `event-audit-service-group`<br>`inventory-service-group`<br>`notification-service-group`<br>`payment-service-group` |
| `order.confirmed` | Payment succeeded; order confirmed and sent to the restaurant | 3 | 1 | 7.0 d | `order-service / OrderEventProducer` | `admin-service / AdminEventConsumer`<br>`coupon-service / CouponEventConsumer`<br>`inventory-service / InventoryEventConsumer`<br>`menu-service / MenuEventConsumer`<br>`notification-service / NotificationEventConsumer`<br>`restaurant-service / RestaurantEventConsumer`<br>`review-service / ReviewEventConsumer` | `admin-service-group`<br>`coupon-service-group`<br>`event-audit-service-group`<br>`inventory-service-group`<br>`menu-service-group`<br>`notification-service-group`<br>`restaurant-service-group`<br>`review-service-group` |
| `order.created` | Order placed and awaiting payment | 3 | 1 | 7.0 d | `order-service / OrderEventProducer` | `cart-service / CartEventConsumer`<br>`customer-service / CustomerEventConsumer`<br>`notification-service / NotificationEventConsumer`<br>`payment-service / PaymentEventConsumer` | `cart-service-group`<br>`customer-service-group`<br>`event-audit-service-group`<br>`notification-service-group`<br>`payment-service-group` |
| `order.rejected` | Order rejected by the restaurant (or by inventory shortage) | 3 | 1 | 7.0 d | `order-service / OrderEventProducer` | `inventory-service / InventoryEventConsumer`<br>`notification-service / NotificationEventConsumer`<br>`payment-service / PaymentEventConsumer` | `event-audit-service-group`<br>`inventory-service-group`<br>`notification-service-group`<br>`payment-service-group` |
| `order.status.updated` | Any order status transition (authoritative state change feed) | 3 | 1 | 7.0 d | `order-service / OrderEventProducer` | `customer-service / CustomerEventConsumer`<br>`delivery-service / DeliveryEventConsumer`<br>`notification-service / NotificationEventConsumer`<br>`restaurant-service / RestaurantEventConsumer` | `customer-service-group`<br>`delivery-service-group`<br>`event-audit-service-group`<br>`notification-service-group`<br>`restaurant-service-group` |
| `payment.failed` | A payment failed, was cancelled or timed out | 3 | 1 | 7.0 d | `payment-service / PaymentEventProducer` | `admin-service / AdminEventConsumer`<br>`notification-service / NotificationEventConsumer`<br>`order-service / OrderEventConsumer` | `admin-service-group`<br>`event-audit-service-group`<br>`notification-service-group`<br>`order-service-group` |
| `payment.initiated` | A payment record was created for an order | 3 | 1 | 7.0 d | `payment-service / PaymentEventProducer` | - | `event-audit-service-group` |
| `payment.success` | A payment was verified successfully | 3 | 1 | 7.0 d | `payment-service / PaymentEventProducer` | `notification-service / NotificationEventConsumer`<br>`order-service / OrderEventConsumer` | `event-audit-service-group`<br>`notification-service-group`<br>`order-service-group` |
| `refund.completed` | A refund finished (COMPLETED or FAILED) | 3 | 1 | 7.0 d | `payment-service / PaymentEventProducer` | `admin-service / AdminEventConsumer`<br>`notification-service / NotificationEventConsumer`<br>`order-service / OrderEventConsumer` | `admin-service-group`<br>`event-audit-service-group`<br>`notification-service-group`<br>`order-service-group` |
| `refund.initiated` | A refund was started for a paid order | 3 | 1 | 7.0 d | `payment-service / PaymentEventProducer` | `notification-service / NotificationEventConsumer`<br>`order-service / OrderEventConsumer` | `event-audit-service-group`<br>`notification-service-group`<br>`order-service-group` |
| `restaurant.approved` | An admin approved a restaurant | 3 | 1 | 7.0 d | `restaurant-service / RestaurantEventProducer` | `admin-service / AdminEventConsumer`<br>`notification-service / NotificationEventConsumer`<br>`search-service / SearchEventConsumer` | `admin-service-group`<br>`event-audit-service-group`<br>`notification-service-group`<br>`search-service-group` |
| `restaurant.registered` | A restaurant was submitted for approval | 3 | 1 | 7.0 d | `restaurant-service / RestaurantEventProducer` | `admin-service / AdminEventConsumer` | `admin-service-group`<br>`event-audit-service-group` |
| `review.created` | A customer submitted a review | 3 | 1 | 7.0 d | `review-service / ReviewEventProducer` | `delivery-service / DeliveryEventConsumer`<br>`restaurant-service / RestaurantEventConsumer`<br>`search-service / SearchEventConsumer` | `delivery-service-group`<br>`event-audit-service-group`<br>`restaurant-service-group`<br>`search-service-group` |
| `user.registered` | A new user account was registered | 3 | 1 | 7.0 d | `user-service / UserEventProducer` | `customer-service / CustomerEventConsumer`<br>`delivery-service / DeliveryEventConsumer`<br>`notification-service / NotificationEventConsumer` | `customer-service-group`<br>`delivery-service-group`<br>`event-audit-service-group`<br>`notification-service-group` |

**Dead-letter topics (25):** one `<topic>.DLT` per business topic, 1 partition each, 28-day retention: `coupon.redeemed.DLT`, `delivery.accepted.DLT`, `delivery.assigned.DLT`, `delivery.completed.DLT`, ...

### Producer → topic → consumer map (from the code of the running services)

| Producer service | Producer class | Topic | Consumer service | Consumer class [group] |
|---|---|---|---|---|
| coupon-service | `CouponEventProducer` | **`coupon.redeemed`** |  | `` |
| delivery-service | `DeliveryEventProducer` | **`delivery.accepted`** | notification-service | `NotificationEventConsumer [notification-service-group]` |
| delivery-service | `DeliveryEventProducer` | **`delivery.assigned`** | notification-service | `NotificationEventConsumer [notification-service-group]` |
| delivery-service | `DeliveryEventProducer` | **`delivery.completed`** | review-service | `ReviewEventConsumer [review-service-group]` |
|  | `` | **`delivery.completed`** | order-service | `OrderEventConsumer [order-service-group]` |
|  | `` | **`delivery.completed`** | admin-service | `AdminEventConsumer [admin-service-group]` |
| delivery-service | `DeliveryEventProducer` | **`delivery.picked-up`** | notification-service | `NotificationEventConsumer [notification-service-group]` |
|  | `` | **`delivery.picked-up`** | order-service | `OrderEventConsumer [order-service-group]` |
| inventory-service | `InventoryEventProducer` | **`inventory.low-stock`** | notification-service | `NotificationEventConsumer [notification-service-group]` |
|  | `` | **`inventory.low-stock`** | admin-service | `AdminEventConsumer [admin-service-group]` |
| inventory-service | `InventoryEventProducer` | **`inventory.reservation-failed`** | order-service | `OrderEventConsumer [order-service-group]` |
| inventory-service | `InventoryEventProducer` | **`inventory.updated`** |  | `` |
| menu-service | `MenuEventProducer` | **`menu.item.created`** | search-service | `SearchEventConsumer [search-service-group]` |
| menu-service | `MenuEventProducer` | **`menu.item.updated`** | search-service | `SearchEventConsumer [search-service-group]` |
| user-service | `UserEventProducer` | **`notification.requested`** | notification-service | `NotificationEventConsumer [notification-service-group]` |
| order-service | `OrderEventProducer` | **`order.cancelled`** | notification-service | `NotificationEventConsumer [notification-service-group]` |
|  | `` | **`order.cancelled`** | payment-service | `PaymentEventConsumer [payment-service-group]` |
|  | `` | **`order.cancelled`** | inventory-service | `InventoryEventConsumer [inventory-service-group]` |
| order-service | `OrderEventProducer` | **`order.confirmed`** | menu-service | `MenuEventConsumer [menu-service-group]` |
|  | `` | **`order.confirmed`** | restaurant-service | `RestaurantEventConsumer [restaurant-service-group]` |
|  | `` | **`order.confirmed`** | review-service | `ReviewEventConsumer [review-service-group]` |
|  | `` | **`order.confirmed`** | notification-service | `NotificationEventConsumer [notification-service-group]` |
|  | `` | **`order.confirmed`** | inventory-service | `InventoryEventConsumer [inventory-service-group]` |
|  | `` | **`order.confirmed`** | admin-service | `AdminEventConsumer [admin-service-group]` |
|  | `` | **`order.confirmed`** | coupon-service | `CouponEventConsumer [coupon-service-group]` |
| order-service | `OrderEventProducer` | **`order.created`** | cart-service | `CartEventConsumer [cart-service-group]` |
|  | `` | **`order.created`** | customer-service | `CustomerEventConsumer [customer-service-group]` |
|  | `` | **`order.created`** | notification-service | `NotificationEventConsumer [notification-service-group]` |
|  | `` | **`order.created`** | payment-service | `PaymentEventConsumer [payment-service-group]` |
| order-service | `OrderEventProducer` | **`order.rejected`** | notification-service | `NotificationEventConsumer [notification-service-group]` |
|  | `` | **`order.rejected`** | payment-service | `PaymentEventConsumer [payment-service-group]` |
|  | `` | **`order.rejected`** | inventory-service | `InventoryEventConsumer [inventory-service-group]` |
| order-service | `OrderEventProducer` | **`order.status.updated`** | restaurant-service | `RestaurantEventConsumer [restaurant-service-group]` |
|  | `` | **`order.status.updated`** | customer-service | `CustomerEventConsumer [customer-service-group]` |
|  | `` | **`order.status.updated`** | delivery-service | `DeliveryEventConsumer [delivery-service-group]` |
|  | `` | **`order.status.updated`** | notification-service | `NotificationEventConsumer [notification-service-group]` |
| payment-service | `PaymentEventProducer` | **`payment.failed`** | notification-service | `NotificationEventConsumer [notification-service-group]` |
|  | `` | **`payment.failed`** | order-service | `OrderEventConsumer [order-service-group]` |
|  | `` | **`payment.failed`** | admin-service | `AdminEventConsumer [admin-service-group]` |
| payment-service | `PaymentEventProducer` | **`payment.initiated`** |  | `` |
| payment-service | `PaymentEventProducer` | **`payment.success`** | notification-service | `NotificationEventConsumer [notification-service-group]` |
|  | `` | **`payment.success`** | order-service | `OrderEventConsumer [order-service-group]` |
| payment-service | `PaymentEventProducer` | **`refund.completed`** | notification-service | `NotificationEventConsumer [notification-service-group]` |
|  | `` | **`refund.completed`** | order-service | `OrderEventConsumer [order-service-group]` |
|  | `` | **`refund.completed`** | admin-service | `AdminEventConsumer [admin-service-group]` |
| payment-service | `PaymentEventProducer` | **`refund.initiated`** | notification-service | `NotificationEventConsumer [notification-service-group]` |
|  | `` | **`refund.initiated`** | order-service | `OrderEventConsumer [order-service-group]` |
| restaurant-service | `RestaurantEventProducer` | **`restaurant.approved`** | notification-service | `NotificationEventConsumer [notification-service-group]` |
|  | `` | **`restaurant.approved`** | admin-service | `AdminEventConsumer [admin-service-group]` |
|  | `` | **`restaurant.approved`** | search-service | `SearchEventConsumer [search-service-group]` |
| restaurant-service | `RestaurantEventProducer` | **`restaurant.registered`** | admin-service | `AdminEventConsumer [admin-service-group]` |
| review-service | `ReviewEventProducer` | **`review.created`** | restaurant-service | `RestaurantEventConsumer [restaurant-service-group]` |
|  | `` | **`review.created`** | delivery-service | `DeliveryEventConsumer [delivery-service-group]` |
|  | `` | **`review.created`** | search-service | `SearchEventConsumer [search-service-group]` |
| user-service | `UserEventProducer` | **`user.registered`** | customer-service | `CustomerEventConsumer [customer-service-group]` |
|  | `` | **`user.registered`** | delivery-service | `DeliveryEventConsumer [delivery-service-group]` |
|  | `` | **`user.registered`** | notification-service | `NotificationEventConsumer [notification-service-group]` |

### Consumer groups (live state)

| Group | State | Topics | Members | Total lag |
|---|---|---|---|---|
| `admin-service-group` | STABLE | 7 | 7 | 0 |
| `cart-service-group` | STABLE | 1 | 1 | 0 |
| `coupon-service-group` | STABLE | 1 | 1 | 0 |
| `customer-service-group` | STABLE | 3 | 3 | 0 |
| `delivery-service-group` | STABLE | 3 | 3 | 0 |
| `event-audit-service-group` | STABLE | 26 | 3 | 0 |
| `inventory-service-group` | STABLE | 3 | 3 | 0 |
| `menu-service-group` | STABLE | 1 | 1 | 0 |
| `notification-service-group` | STABLE | 16 | 16 | 0 |
| `order-service-group` | STABLE | 7 | 7 | 0 |
| `payment-service-group` | STABLE | 3 | 3 | 0 |
| `restaurant-service-group` | STABLE | 3 | 3 | 0 |
| `review-service-group` | STABLE | 2 | 2 | 0 |
| `search-service-group` | STABLE | 3 | 4 | 0 |

### Real event examples (read back from Kafka, sensitive fields masked)

**`order.created`**, key `57`, partition 2, offset 11, headers {"eventId": "17f1b991-bebf-4d73-ada4-63e45a261bde", "eventType": "OrderCreated", "X-Correlation-Id": "218facf0-6b86-4127-acdd-691e244f1dbd"}

```json
{
  "eventId" : "17f1b991-bebf-4d73-ada4-63e45a261bde",
  "eventType" : "OrderCreated",
  "eventVersion" : "1.0",
  "eventTimestamp" : "2026-11-20T19:00:46.733996529Z",
  "aggregateId" : "57",
  "correlationId" : "218facf0-6b86-4127-acdd-691e244f1dbd",
  "producerService" : "order-service",
  "payload" : {
    "orderId" : 57,
    "orderNumber" : "FD20261121-NBY5WH",
    "customerId" : 51,
    "restaurantId" : 2,
    "restaurantOwnerUserId" : 12,
    "totalAmount" : 292.5,
    "items" : [ {
      "menuItemId" : 3,
      "name" : "Chicken Biryani",
      "quantity" : 1,
      "unitPrice" : 250.0,
      "variant" : "Half"
    } ]
  }
}
```

**`payment.success`**, key `57`, partition 2, offset 15, headers {"eventId": "de65e1ea-31d3-40bb-bc0f-585a04e74a16", "eventType": "PaymentSuccess", "X-Correlation-Id": "63191287-6bed-437f-83d7-3918d5b6c85d"}

```json
{
  "eventId" : "de65e1ea-31d3-40bb-bc0f-585a04e74a16",
  "eventType" : "PaymentSuccess",
  "eventVersion" : "1.0",
  "eventTimestamp" : "2026-11-20T19:00:47.543608269Z",
  "aggregateId" : "57",
  "correlationId" : "63191287-6bed-437f-83d7-3918d5b6c85d",
  "producerService" : "payment-service",
  "payload" : {
    "paymentId" : 57,
    "orderId" : 57,
    "customerId" : 51,
    "amount" : 292.5,
    "transactionRef" : "SBX-27D7B0AE-A26",
    "provider" : "SANDBOX"
  }
}
```

**`order.status.updated`**, key `57`, partition 2, offset 41, headers {"eventId": "c17ce71e-c647-42b1-8d7b-0bf5a1cd2cc2", "eventType": "OrderStatusUpdated", "X-Correlation-Id": "63191287-6bed-437f-83d7-3918d5b6c85d"}

```json
{
  "eventId" : "c17ce71e-c647-42b1-8d7b-0bf5a1cd2cc2",
  "eventType" : "OrderStatusUpdated",
  "eventVersion" : "1.0",
  "eventTimestamp" : "2026-11-20T19:00:47.633743179Z",
  "aggregateId" : "57",
  "correlationId" : "63191287-6bed-437f-83d7-3918d5b6c85d",
  "producerService" : "order-service",
  "payload" : {
    "orderId" : 57,
    "orderNumber" : "FD20261121-NBY5WH",
    "customerId" : 51,
    "restaurantId" : 2,
    "restaurantOwnerUserId" : 12,
    "previousStatus" : "PAYMENT_PENDING",
    "newStatus" : "CONFIRMED",
    "reason" : "Payment received (SBX-27D7B0AE-A26)",
    "totalAmount" : 292.5,
    "pickupAddress" : "1 Indiranagar Main, Bengaluru",
    "deliveryAddress" : "12 MG Road, Bengaluru 560001",
    "deliveryCity" : "Bengaluru",
    "customerName" : "UI Customer"
  }
}
```

**`delivery.assigned`**, key `48`, partition 0, offset 3, headers {"eventId": "d3823cc6-3445-4056-a851-52f7e438c843", "eventType": "DeliveryAssigned", "X-Correlation-Id": "6bbc37fb-cf88-4e7d-ab41-98326340131e"}

```json
{
  "eventId" : "d3823cc6-3445-4056-a851-52f7e438c843",
  "eventType" : "DeliveryAssigned",
  "eventVersion" : "1.0",
  "eventTimestamp" : "2026-11-20T18:59:49.889033012Z",
  "aggregateId" : "48",
  "correlationId" : "6bbc37fb-cf88-4e7d-ab41-98326340131e",
  "producerService" : "delivery-service",
  "payload" : {
    "deliveryId" : 7,
    "orderId" : 48,
    "partnerUserId" : 49,
    "customerId" : 46,
    "pickupAddress" : "1 Indiranagar Main, Bengaluru",
    "deliveryAddress" : "99 Residency Rd, Bengaluru 560001"
  }
}
```

**`refund.completed`**, key `55`, partition 0, offset 21, headers {"eventId": "ffa83e23-4b79-4944-b236-530cb2b12b0e", "eventType": "RefundCompleted", "X-Correlation-Id": "3b413810-7f50-43ea-8d88-ffc3ef8b02a6"}

```json
{
  "eventId" : "ffa83e23-4b79-4944-b236-530cb2b12b0e",
  "eventType" : "RefundCompleted",
  "eventVersion" : "1.0",
  "eventTimestamp" : "2026-11-20T19:00:31.602470009Z",
  "aggregateId" : "55",
  "correlationId" : "3b413810-7f50-43ea-8d88-ffc3ef8b02a6",
  "producerService" : "payment-service",
  "payload" : {
    "refundId" : 36,
    "paymentId" : 55,
    "orderId" : 55,
    "customerId" : 46,
    "amount" : 292.5,
    "status" : "COMPLETED",
    "reason" : "Order cancelled: cleanup"
  }
}
```



---

## 8. Redis caching

Spring's cache abstraction on Redis (`@EnableCaching`, `RedisCacheManager`), configured once in `common/.../cache/CacheConfig.java`:
keys `food:<cache>::<key>`, **typed JSON** values, a **TTL per cache** from `food.cache.ttls.*`, and a *cache error handler* so a broken
Redis degrades to "read the database" instead of failing requests. A decorator logs every `HIT` / `MISS` / `PUT` / `EVICT` as structured
log lines (they feed the Kibana panel "Redis cache activity"):

```java
// common/src/main/java/com/fooddelivery/common/cache/CacheConfig.java
@Override public ValueWrapper get(Object key) {
    ValueWrapper w = delegate.get(key);
    clog.info("Redis cache {} cache={} key={}", w == null ? "MISS" : "HIT", getName(), key);
    return w;
```

| Cache | Service | TTL | Invalidated when |
|---|---|---|---|
| `restaurant` (detail) | restaurant | 10 min | restaurant edited / approved / hours / availability / rating changes |
| `restaurant-list` (search pages) | restaurant | 2 min | any restaurant change (whole cache cleared: it is cheap to rebuild) |
| `restaurant-cuisines` | restaurant | 30 min | approval / status change |
| `menu` (a restaurant's whole menu) | menu | 5 min | any category/item write (evicted **after commit**) |
| `menu-item` | menu | 10 min | item update / availability / image / delete |
| `menu-popular` | menu | 15 min | new confirmed orders |
| `coupon-public` | coupon | 5 min | coupon / campaign create or change |
| `review-summary` | review | 5 min | any review change |
| `search`, `search-reference` | search | 10 s / 15 min | index updates (evicted after commit; the 10 s TTL also bounds the rare read-then-evict-then-put race) |
| `cart` (priced view) | cart | 1 min | every cart change (so totals are never stale for long, and always re-priced by the server) |

Not cached on purpose: tokens, passwords, payments, order state, anything personal and sensitive. Redis is also used for the
**JWT deny-list** (logout) and the **gateway rate limiter**.

Gotcha worth knowing (it is in the code as a comment): `@CacheEvict` is ignored on *self-invocation* (a method calling another method of the
same class bypasses the Spring proxy), so `MenuService.evictMenu` evicts programmatically **after commit** instead:

{{code menu-service/src/main/java/com/fooddelivery/menu/service/MenuService.java | private void evictMenu | ^    }$ | java}}

---

## 9. Logging, correlation ids and the ELK pipeline

**Flow:** every service writes **structured JSON** with Log4j2 → `logs/<service>.json.log` → **Logstash** reads the files → **Elasticsearch**
(`food-logs-YYYY.MM.dd`, 14-day ILM retention) → **Kibana** dashboard and the Angular *Observability / Log search* screens.

Logback is excluded in the parent POM and Log4j2 is the only backend. One `log4j2-spring.xml` in the shared jar configures all services:
console text (with `cid=` and `trace=`), and a rolling JSON file (size + time based, gzip archive):

```xml
// common/src/main/resources/log4j2-spring.xml
<RollingFile name="JsonFile" fileName="${LOG_DIR}/${SERVICE}.json.log"
             filePattern="${LOG_DIR}/archive/${SERVICE}-%d{yyyy-MM-dd}-%i.json.log.gz">
  <JsonTemplateLayout eventTemplateUri="classpath:FoodLogTemplate.json">
    <EventTemplateAdditionalField key="service" value="${SERVICE}"/>
    <EventTemplateAdditionalField key="environment" value="${ENVIRONMENT}"/>
  </JsonTemplateLayout>
  <Policies>
    <TimeBasedTriggeringPolicy/>
    <SizeBasedTriggeringPolicy size="25MB"/>
  </Policies>
  <DefaultRolloverStrategy max="10"/>
</RollingFile>
```

Every log line carries `@timestamp, level, logger, thread, message, service, environment, correlationId, traceId, spanId, userId`, and for
HTTP lines `httpMethod, httpPath, httpStatus, durationMs`; exceptions carry `error.class, error.message, error.stack_trace`:

{{code common/src/main/resources/FoodLogTemplate.json | "@timestamp" | ^\} | json}}

**Correlation id, end to end.** The gateway creates `X-Correlation-Id` (or keeps the one the browser sent: Angular generates one per
click); `CorrelationIdFilter` puts it in the logging context; Feign (`FeignConfig`) and WebClient (`RemoteClient`) forward it; the
outbox row stores it, the Kafka envelope + header carry it, and the consumer restores it into *its* logging context. One id therefore
follows `API Gateway → Order → Payment → Kafka → Restaurant → Delivery → Notification`. Micrometer Tracing adds a `traceId` for the
HTTP hops.

{{code common/src/main/java/com/fooddelivery/common/web/CorrelationIdFilter.java | protected void doFilterInternal | ^    }$ | java}}

**Logstash** (`infrastructure/logstash/pipeline/food-logs.conf`) parses the JSON, normalises types and adds a `category` field
(`api-request`, `kafka-producer`, `kafka-consumer`, `redis-cache`, `payment`, `order-lifecycle`, `application`) so dashboards can slice
without text search. **Elasticsearch** gets an index template and an ILM delete-after-14-days policy
(`infrastructure/elasticsearch/setup-elasticsearch.sh`). **Kibana**: `infrastructure/kibana/setup-kibana.sh` imports a data view
(`food-logs-*`, time field `@timestamp`) and the dashboard *Food Delivery - Operations*: total/error/warning/info counts, logs by service
and by level, logs over time, exception trends, API activity by status, Kafka producer logs, Kafka consumer logs, Redis cache
activity, payment events (no sensitive data), order lifecycle, recent errors, and a saved search for correlation/trace ids
(type `correlationId:"…"` or `traceId:"…"` in the query bar, or pick a time range).

**Angular logging area** (admin only; it calls `/api/logs/*` of event-audit-service, which queries Elasticsearch with a **fixed
whitelist of filters**: the browser cannot send raw queries): service health table (Eureka + Actuator: status, URL, port, DB/Redis/Kafka),
overview counts, log search with level / time range / correlation id / trace id / category filters, recent errors, log detail with the
**stack trace**, and a button that opens Kibana.

Never logged: passwords, tokens, refresh tokens, card data. Payment logs contain order numbers, amounts and provider references only.

---

## 10. Security

* **JWT (HS256)**: access token 30 min, refresh token 7 days. Claims: user id, username, roles, **permissions**, token id. The refresh
  token is stored only as a **SHA-256 hash** and **rotated on every use**; presenting an already-used refresh token is treated as theft
  and revokes all of that user's sessions. Passwords use **BCrypt**.
* **Logout** puts the access token's id on a Redis **deny-list**; the gateway *and* every service check it.
* **Two layers of authentication.** The gateway validates the token (signature, issuer, expiry, deny-list) and applies coarse rules
  (`/api/admin/**`, `/api/kafka/**`, `/api/logs/**` need an admin role). **Each service validates the token again** and enforces
  fine-grained rules with `@PreAuthorize`: gateway validation alone is never trusted.
* **Roles** `CUSTOMER, RESTAURANT_OWNER, RESTAURANT_STAFF, DELIVERY_PARTNER, ADMIN, SUPER_ADMIN` and **permissions**
  (`RESTAURANT_APPROVE, COUPON_MANAGE, REVIEW_MODERATE, REFUND_MANAGE, KAFKA_MONITOR, KAFKA_REPLAY, LOG_VIEW, USER_MANAGE, ADMIN_CREATE,
  SYSTEM_CONFIG`) carried as `PERM_*` authorities: e.g. only a SUPER_ADMIN may replay Kafka messages or edit system configuration.
* **Internal endpoints** (`/internal/**`) are not routed by the gateway and still need a valid token; services call each other with
  the user's own token when there is one, otherwise a short-lived **service token** (`ROLE_SERVICE`).
* **Ownership rules** are enforced in the service (an owner can only touch their restaurant; a customer only their order, address, payment).
* **CSRF:** disabled on purpose and documented in `SecurityConfig`: the API is stateless bearer-token (no cookies, no session), so there
  is nothing for a cross-site request to ride on. **CORS** is configured once at the gateway. Sessions: `STATELESS`.
* **Actuator:** only `/actuator/health/**` and `/actuator/info` are anonymous; health *details* need ADMIN or the service token; metrics need authentication.
* **Validation:** Jakarta Bean Validation everywhere, a custom `@StrongPassword`, a class-level cross-field `@PasswordsMatch`, uniform
  error bodies from one `@RestControllerAdvice`.
* **Files:** size limit (2 MB), PNG/JPEG/WEBP only, **magic-byte check** (not just the declared type), server-generated names, folder allow-list.

```java
// common/src/main/java/com/fooddelivery/common/security/SecurityConfig.java
.authorizeHttpRequests(a -> {
    a.requestMatchers("/actuator/health/**", "/actuator/info", "/v3/api-docs/**", "/swagger-ui/**",
            "/swagger-ui.html", "/servlet/**", "/error").permitAll();
    a.requestMatchers(HttpMethod.GET, "/api/files/**").permitAll();
    if (!paths.publicPaths().isEmpty()) a.requestMatchers(paths.publicPaths().toArray(String[]::new)).permitAll();
    if (!paths.publicGetPaths().isEmpty()) a.requestMatchers(HttpMethod.GET, paths.publicGetPaths().toArray(String[]::new)).permitAll();
    a.anyRequest().authenticated();
```
```java
// user-service/src/main/java/com/fooddelivery/user/service/AuthService.java
if (stored.isRevoked()) {
    // reuse of a rotated token = possible theft -> kill every session of this user
    refreshTokens.revokeAllForUser(stored.getUserId());
    log.warn("Refresh-token reuse detected for user {}; all sessions revoked", stored.getUserId());
    throw new BusinessException(HttpStatus.UNAUTHORIZED, "TOKEN_REUSED", "Refresh token was already used");
}
stored.setRevoked(true);
User u = users.findById(stored.getUserId()).orElseThrow();
if (u.getStatus() != UserStatus.ACTIVE) throw new BusinessException(HttpStatus.FORBIDDEN, "ACCOUNT_DISABLED", "This account is not active");
return issue(u);
```

---

## 11. Resilience

Resilience4j is applied only where it is safe, and **order creation and payments are never retried automatically**:

| Call | Policy |
|---|---|
| cart selection, restaurant lookup, coupon check (reads) | circuit breaker + retry (2 attempts, exponential back-off) + bulkhead |
| coupon validation at checkout | fails **closed**: if it cannot be verified the order is refused rather than silently un-discounted |
| inventory pre-check | circuit breaker, fails **open** with a warning (the real, locked check happens again when the order is confirmed) |
| contact lookup for notifications | circuit breaker with fallback: notifications degrade to in-app only |
| admin dashboard fan-out | WebClient `Mono.zip` + `@TimeLimiter` + `@RateLimiter`; one failing section degrades alone |
| gateway → service | per-route circuit breaker with fallback `/fallback/{service}` (clean 503 JSON), 20 s time limiter, Redis rate limiter (50 req/s, burst 100) |
| WebClient GET | retried only on connection/5xx failures; POST/PUT/PATCH/DELETE never |

```java
// order-service/src/main/java/com/fooddelivery/order/client/Gateways.java
@CircuitBreaker(name = "inventory", fallbackMethod = "inventoryFallback")
public InvCheckResponse inventory(InvCheckRequest r) { return inventory.check(r); }

InvCheckResponse inventoryFallback(InvCheckRequest r, Throwable t) {
    log.warn("Inventory service unavailable; skipping pre-check (will be enforced at confirmation): {}", t.toString());
    return new InvCheckResponse(true, List.of());
```
{{code common/src/main/java/com/fooddelivery/common/http/RemoteClient.java | public <T> Mono<T> get\(String service, String path, Class<T> type | ^    }$ | java}}

Timeouts: Feign connect 2 s / read 5 s; WebClient connect 2 s / response 5 s; Kafka producer `max.block.ms` 5 s. Graceful shutdown (20 s) lets
in-flight requests finish. Health: `/actuator/health` with liveness/readiness probes and a custom **kafka** indicator beside the built-in db and redis.

---

## 12. Synchronous communication: Feign and WebClient, in real business scenarios

**OpenFeign** is the *declarative* client: you write an interface, Spring generates the HTTP code; resolution by service name goes
through Eureka and the client-side load balancer. Used for: order → cart / coupon / inventory, payment → order, customer → order,
notification → user, cart → restaurant / coupon, menu → restaurant, inventory → restaurant. Global behaviour lives in
`common/.../http/FeignConfig.java`: an interceptor that forwards the **Authorization** header (user token, else service token) and
the **correlation id**, and a custom **ErrorDecoder** that turns remote failures into `RemoteServiceException` (4xx stay 4xx for the
caller, 5xx become 502).

{{code order-service/src/main/java/com/fooddelivery/order/client/Clients.java | @FeignClient\(name = "coupon-service" | ^    } | java}}

**WebClient** is used where calls should be *composed*: three independent lookups fired in parallel with `Mono.zip` and blocked on **once**,
at the boundary of a servlet-based service (order placement, the admin dashboard, delivery's order lookup, search's offers). Cross-cutting
behaviour is in one place, `RemoteClient`: load balancing, timeouts, logging + error-mapping exchange filters, correlation id,
auth propagation, retry **for GET only**:

{{code order-service/src/main/java/com/fooddelivery/order/client/ReactiveLookups.java | public Mono<AddressInfo> address | ^    }$ | java}}

(There is no `.block()` sprinkled through the code: the few that exist are at the edge of a request or a Kafka listener, with a timeout.)

---

## 13. Where every concept lives (patterns → files)

### 13.1 Core Java in business code

| Concept | Where it is used for real |
|---|---|
| Classes, encapsulation, constructors, `final` | every service/entity; services take dependencies through **constructors** (`final` fields) |
| Interfaces + polymorphism + **Strategy/Adapter** | `PaymentProvider` (→ `SandboxPaymentProvider`), `NotificationChannel` (→ `InAppChannel`, `SandboxEmailChannel`, `SandboxSmsChannel`), `SearchEngine` (→ `MySqlSearchEngine`), `FileStorageService` (→ `LocalFileStorageService`) |
| Abstract class / inheritance | `AuditableEntity` (`@MappedSuperclass`: created/updated by/at, used by most entities) |
| Enums with behaviour | `OrderStatus.next()/canMoveTo()/customerCancellable()`, `Permission.forRoles()` |
| **Records** (immutable) | all DTOs, all Kafka payloads (`Events.*`), `EventEnvelope`, `JwtProperties` |
| Generics | `PageResponse<T>`, `RemoteClient.get(…, Class<T>)`, `EventConsumerSupport.handle(…, Class<P>, BiConsumer<EventEnvelope,P>)` |
| Collections | `Map<Long, List<Recipe>>` grouping, `TreeMap` for lock ordering, `LinkedHashMap` for ordered JSON, `Set` for permissions, `ConcurrentHashMap` for retry counters and WebClient cache |
| Streams, lambdas, `Optional`, method refs | everywhere: e.g. `OrderQueryService`, `MySqlSearchEngine`, `InventoryService.availability` |
| Date/time | `Instant` for all stored timestamps (UTC), `LocalTime` + `DayOfWeek` for opening hours incl. overnight spans |
| Exceptions | `BusinessException` hierarchy (`NotFound`, `Conflict`, `BadRequest`, `Forbidden`), `RemoteServiceException`, `InvalidEventException` |
| Concurrency | `CompletableFuture` + `@TimeLimiter` (admin dashboard), `ExecutorService` (health probes), `AtomicLong`, `synchronized` token cache, `ConcurrentHashMap`, DB locks |
| JVM / GC | `java -Xms128m -Xmx384m` per service (`scripts/common.sh`); each service is a separate JVM so one leak cannot take down the platform |

### 13.2 Servlets and Spring MVC

Spring MVC *is* a servlet: `DispatcherServlet` receives every request from the embedded Tomcat and routes it to `@RestController`s.
The project shows the layers below it with a **plain `HttpServlet`** (`ServiceInfoServlet`, `GET /servlet/info` on every service),
registered next to the DispatcherServlet:

{{code common/src/main/java/com/fooddelivery/common/web/ServiceInfoServlet.java | public void init\(ServletConfig | ^    }$ | java}}
```java
// common/src/main/java/com/fooddelivery/common/web/ServiceInfoServlet.java
if ("health".equals(forward)) {
    req.setAttribute("forwardedBy", "ServiceInfoServlet");    // request attribute travels with a forward
    req.getRequestDispatcher("/actuator/health").forward(req, resp);
    return;
}
if ("info".equals(redirect)) {
    resp.sendRedirect("/actuator/info");                      // client round-trip
```

* **Lifecycle:** `init()` once, `service/doGet` per request, `destroy()` on shutdown (all logged). **ServletConfig** (init-param `service-name`)
  vs **ServletContext** (application-wide server info), **request parameters / attributes**, **response headers**, **cookies** (`food_visits`),
  **RequestDispatcher forward** (`?forward=health`, same request, server side) vs **redirect** (`?redirect=info`, HTTP 302 round trip).
* **Filters:** `CorrelationIdFilter` (before Spring Security) and `JwtAuthenticationFilter` (inside the security chain).
* **Listener:** `ServletContextListener` registered in `ServletConfig` (container start/stop).
* **Session management:** the API is *deliberately sessionless* (`getSession(false)` reports `sessionCreated:false`, `STATELESS` policy).
* Modern **`jakarta.servlet`** only (no `javax.*`); Tomcat 10.1.
* **Spring MVC:** all HTTP verbs, path variables, query params, `@RequestBody` DTOs, `ResponseEntity`/status codes, headers
  (`Idempotency-Key`, `X-Correlation-Id`), `@Valid`, pagination + sorting (`PageResponse`), filtering with JPA **Specifications**,
  multipart upload (`@RequestPart MultipartFile`) and file download (`FileController`), content negotiation (JSON), global error handling
  (`GlobalExceptionHandler`), CORS (gateway).

### 13.3 Spring Core and Boot

Constructor injection throughout; `@Component/@Service/@Repository/@RestController/@Configuration/@Bean`; `@Primary/@Qualifier` free
because each type has one bean; **profiles** (`application-dev.yml`, `application-prod.yml`: debug logging + Swagger on vs. quiet logs +
Swagger off); **`@ConfigurationProperties`** (`JwtProperties`, `SecurityConfig.PublicPaths`, `CacheConfig.CacheProps`) and `@Value`;
conditional wiring (`ProviderRegistry` refuses to start if `food.payment.provider` names something that is not implemented);
**application events** (`ApplicationReadyEvent` → announce Kafka topology); **BeanPostProcessor** (`TopologyRegistry`); graceful
shutdown; Actuator health/readiness/liveness; `ApplicationRunner` (bootstrap super-admin); scheduling (`@Scheduled`: outbox relay,
payment watchdog, refund worker, assignment sweep, audit purge). Shared configuration is imported (`spring.config.import: classpath:food-common.yml`) so
each service's own `application.yml` is only: name, port, datasource URL, and what is special about it.

### 13.4 Hibernate / JPA

| Concept | Example |
|---|---|
| Entities, generated ids, `@Version` | all `*/domain/*.java` |
| 1:1 / 1:N / N:1 + cascade + `orphanRemoval` | `Cart→CartItem`, `Restaurant→OpeningHour`, `CustomerOrder→OrderItem/OrderStatusHistory`, `Customer→Address` |
| `@ElementCollection` | restaurant cuisines/images, user roles |
| `@Embedded`/`@Embeddable` | `Customer.preferences`, `CustomerOrder.deliveryAddress` (an address *snapshot*) |
| `@Enumerated(STRING)` | statuses everywhere |
| Auditing | `AuditableEntity` + `@EnableJpaAuditing` + `AuditorAware` (who/when) |
| Derived queries, JPQL, **native SQL**, **Specifications (Criteria API)** | `RestaurantRepository`, `DeliveryRepository.averageDeliveryMinutes` (native), `RestaurantService.search` |
| **N+1 problem & its cures** | `@EntityGraph` on `findDetailed`, `join fetch` in `MenuItemRepository.findMenu`, `default_batch_fetch_size: 16` |
| Lazy vs eager | LAZY collections/associations; DTOs built inside the transaction; `open-in-view: false` so lazy entities can never leak into JSON |
| Transactions | `@Transactional` services, `readOnly` queries, `Propagation.MANDATORY` for the outbox, `TransactionTemplate` where a manual boundary is needed, isolation `READ_COMMITTED` for the stock check |
| **Optimistic / pessimistic locking** | `@Version` on `Ingredient`, `CustomerOrder`…; `@Lock(PESSIMISTIC_WRITE)` + `SKIP LOCKED` in `OutboxRepository`, `IngredientRepository`, `DeliveryPartnerRepository` |
| Indexes & unique constraints | declared on each entity (`@Table(indexes=…, uniqueConstraints=…)`) and mirrored in Flyway `V1__init.sql` |

```java
// restaurant-service/src/main/java/com/fooddelivery/restaurant/service/RestaurantService.java
Specification<Restaurant> spec = (root, query, cb) -> {
    List<Predicate> p = new ArrayList<>();
    if (status != null) p.add(cb.equal(root.get("status"), status));
    if (q != null && !q.isBlank()) p.add(cb.like(cb.lower(root.get("name")), "%" + q.toLowerCase().trim() + "%"));
    return cb.and(p.toArray(Predicate[]::new));
```

### 13.5 AOP

`CrossCuttingAspect` (aspects for cross-cutting concerns only, never business rules): **@Before / @AfterReturning / @AfterThrowing / @After**
on every `@RestController` (call trace), **@Around** on methods annotated `@Audited` (audit trail: *who*, *what*, *how long*, *outcome*), and
**@Around** on the service layer (slow-call warning > 1 s). Pointcuts are the expressions; join points are method executions.

{{code common/src/main/java/com/fooddelivery/common/aop/CrossCuttingAspect.java | @Around\("@annotation\(audited\)"\) | ^    }$ | java}}

### 13.6 Other patterns, quick index

| Pattern | File |
|---|---|
| API Gateway, circuit breaker + fallback, rate limiting | `api-gateway/.../RouteConfig.java`, `FallbackController.java`, `KeyResolverConfig.java`, `application.yml` |
| Gateway authentication filter | `api-gateway/.../JwtGlobalFilter.java` |
| Service discovery | `service-discovery/`, `lb://` routes, Feign/WebClient by service name |
| Transactional outbox / idempotent consumer / DLT | `common/.../kafka/*` |
| Saga (choreography) + compensation | `OrderWorkflowService`, `PaymentService.onOrderVoided`, `InventoryService.consumeForOrder` |
| State machine | `OrderStatus`, `OrderStateMachine` |
| Idempotency key | `OrderPlacementService`, `PaymentService.pay`, Angular `CheckoutComponent` |
| Webhook signature + de-duplication | `PaymentController.callback`, `PaymentService.callback` |
| Provider adapter / sandbox | `provider/PaymentProvider.java` |
| Read model from events | `InboxService`, `SearchService`, `ReviewService.onDeliveryCompleted` |
| Competing-consumer-safe assignment | `DeliveryService.tryAssign` (+ `lockAvailable`) |
| Cache-aside + invalidation | `RestaurantService`, `MenuService`, `CacheConfig` |
| Request-to-event traceability | `CorrelationIdFilter`, `EventPublisher`, `EventConsumerSupport`, `GET /api/audit/trace/{cid}` |

{{code payment-service/src/main/java/com/fooddelivery/payment/provider/PaymentProvider.java | public interface PaymentProvider | ^\} | java}}
{{code payment-service/src/main/java/com/fooddelivery/payment/service/PaymentService.java | public Dtos.CallbackResponse callback | ^    }$ | java}}
{{code delivery-service/src/main/java/com/fooddelivery/delivery/service/DeliveryService.java | public boolean tryAssign | ^    }$ | java}}

---

## 14. The Angular frontend

`frontend/` (Angular 19, **standalone components**, **signals**, RxJS, reactive forms, Angular Material, lazy-loaded routes). It talks **only to
the gateway** (dev server proxy `/api → :9080`, see `proxy.conf.json`).

```
frontend/src/app/
├── core/            auth (AuthService: session as signals), interceptors, guards, models, API services (CustomerApi, OwnerApi, DeliveryApi, AdminApi, MonitoringApi)
├── shared/          material.ts (one import list), components (data table, status chip, JSON viewer, stars, confirm dialog), pipes (money, timeAgo, label), HasRole directive
├── layout/          ShellComponent: toolbar, role-based sidenav, notification bell, cart badge
├── features/        authentication · customer · restaurant-admin (owner) · delivery · system-admin · kafka-monitoring · logging
├── app.config.ts    providers: router, HttpClient + interceptors
└── app.routes.ts    lazy routes + role guards
```

| Concept | Where |
|---|---|
| Standalone components + lazy loading | every route in `app.routes.ts` uses `loadComponent(() => import(…))` |
| Signals | `AuthService.user/roles` (computed), page state (`signal`, `computed`) in every component |
| HTTP interceptors | `http.interceptors.ts`: bearer token + **a new `X-Correlation-Id` per request** + one-shot **token refresh on 401** + error snackbar |
| Route guards | `authGuard`, `roleGuard('ADMIN','SUPER_ADMIN')`: wrong role → redirected to its own home (the API enforces the same rules) |
| Reactive forms + custom validators | login/register (`strong` password, `match` cross-field validator), address, restaurant, coupon, item form with `FormArray` for variants/add-ons |
| Role-based navigation | `ShellComponent.items` (computed from roles); `*appHasRole` directive |
| Idempotent checkout | `CheckoutComponent` generates **one `Idempotency-Key` per checkout attempt**, so a double click can never place two orders |
| Polling for eventual consistency | order detail (4 s), owner orders (5 s), delivery dashboard (4 s), notification badge (20 s) |
| Event-flow graph | `KafkaFlowComponent`: an SVG drawn from `/api/kafka/flow` |

{{code frontend/src/app/core/interceptors/http.interceptors.ts | export const authInterceptor | ^\};$ | typescript}}

**Screens implemented (and only what the backend supports):**
*Customer:* register, login, forgot/reset password, home (search with suggestions, "near me", cuisines, offers, campaigns, popular dishes), restaurant list with filters,
restaurant page (menu with variants/add-ons/instructions, reviews, hours), cart (server-priced, coupon), checkout (address, payment method, sandbox outcome, idempotent
place+pay), my orders (search/filter/paginate), order tracking (stepper, status history, payment, refund, delivery), cancel, review (restaurant + delivery + dishes),
profile (preferences, avatar, change password), addresses, saved payment methods, notifications.
*Restaurant owner:* dashboard (sales, live orders, low stock, accepting-orders switch), profile + hours + logo/photos, menu (categories, items, variants, add-ons, availability,
image, deactivate), orders (accept / reject / prepare / ready), inventory (ingredients, restock, adjust, history, recipes), reviews.
*Delivery partner:* online/offline, assignment (accept/reject with expiry), pickup, delivered, history, performance, profile.
*Admin:* dashboard, users, restaurant approvals/suspension, orders, payments, refunds (retry), delivery + assignment trail, coupons + campaigns, review moderation,
inventory overview, system configuration, activity feed, **Kafka monitoring** (topics, messages, audit history, event flow, consumer groups & lag, failed + dead-letter, test publish, replay),
**observability** (service health, log overview, log search by correlation/trace id, stack traces, link to Kibana).

---

## 15. A full request, traced end to end

*"The customer taps **Place order & pay**."* The numbers below are the **real** rows captured from one order of the end-to-end run
(`scripts/e2e.py` → `scripts/gen_trace_doc.py`): the same correlation id was found in the logs of several services and in the Kafka audit store.

**Step by step**

1. **Angular** (`CheckoutComponent.place`) sends `POST /api/orders` with `Idempotency-Key` and a fresh `X-Correlation-Id`.
2. **Gateway** (`JwtGlobalFilter`) validates the JWT, rate-limits, picks an `order-service` instance from Eureka, forwards the correlation id, logs `POST /api/orders -> 201`.
3. **order-service** (`OrderPlacementService`): Feign → cart (selection), WebClient (in parallel) → customer address, restaurant, menu prices; Feign → inventory pre-check and
   coupon validation; then **one DB transaction**: order + items + history + two outbox rows (`order.created`, `order.status.updated`).
4. **`OutboxRelay`** (≤ 0.5 s later) publishes both to Kafka with key = order id, headers `eventId`, `eventType`, `X-Correlation-Id`.
5. **payment-service** consumes `order.created` (`PaymentEventConsumer`), asks order-service for the authoritative amount (Feign + circuit breaker), creates the `PENDING`
   payment → outbox → `payment.initiated`. **cart-service** consumes the same event and empties the cart; **customer-service** records the activity;
   **notification-service** tells the customer "order placed".
6. The customer pays (`POST /api/payments/order/{id}/pay`, SANDBOX): `payment.success` → **order-service** consumes it, moves the order to `CONFIRMED`, writes
   history and publishes `order.confirmed` → inventory consumes stock (row lock), coupon-service records the redemption, the restaurant's inbox gets the order,
   the owner is notified. Each consumer wrote a `PROCESSED` row to the audit store.
7. The owner, delivery partner and the Saga continue as described in section 4.

**Correlation id `e2e-order-5201182`**: the id the browser/test client sent in `X-Correlation-Id` when it placed the order. Everything below was found by searching that one value.

#### a) Log lines in Elasticsearch (Log4j2 → Logstash → Elasticsearch), oldest first

| Time (UTC) | Service | Level | Category | Message |
|---|---|---|---|---|
| 18:59:47.350 | order-service | DEBUG | application | -> OrderController.place |
| 18:59:47.362 | cart-service | INFO | api-request | GET /api/cart/selection -> 200 (8 ms) |
| 18:59:47.377 | customer-service | INFO | api-request | GET /internal/customers/46/addresses/29 -> 200 (12 ms) |
| 18:59:47.379 | customer-service | INFO | api-request | GET /internal/customers/46 -> 200 (11 ms) |
| 18:59:47.381 | menu-service | INFO | api-request | POST /internal/menu/validate -> 200 (14 ms) |
| 18:59:47.384 | restaurant-service | INFO | api-request | GET /internal/restaurants/9 -> 200 (18 ms) |
| 18:59:47.398 | inventory-service | INFO | api-request | POST /internal/inventory/check -> 200 (10 ms) |
| 18:59:47.411 | coupon-service | INFO | api-request | POST /internal/coupons/validate -> 200 (9 ms) |
| 18:59:47.418 | order-service | INFO | kafka-producer | Outbox: queued OrderCreated for topic order.created key=48 eventId=c5480cd8-c5ef-46fb-8fc9-a33c3a11f603 |
| 18:59:47.419 | order-service | INFO | kafka-producer | Outbox: queued OrderStatusUpdated for topic order.status.updated key=48 eventId=040806c0-a505-4d6d-952a-628de7 |
| 18:59:47.420 | order-service | INFO | order-lifecycle | Order FD20261121-WCFZFT status CREATED -> PAYMENT_PENDING by system |
| 18:59:47.420 | order-service | DEBUG | application | OrderStateMachine.transition(..) took 1 ms |
| 18:59:47.425 | order-service | INFO | order-lifecycle | Order FD20261121-WCFZFT placed by customer 46 total=408.00 restaurant=9 |
| 18:59:47.428 | order-service | DEBUG | application | OrderPlacementService.place(..) took 78 ms |
| 18:59:47.429 | order-service | DEBUG | application | <- place returned OrderDto |
| 18:59:47.430 | order-service | INFO | api-request | POST /api/orders -> 201 (83 ms) |
| 18:59:47.431 | api-gateway | INFO | api-request | POST /api/orders -> 201 (87 ms) |
| 18:59:47.757 | order-service | INFO | kafka-producer | Kafka published OrderCreated eventId=c5480cd8-c5ef-46fb-8fc9-a33c3a11f603 topic=order.created partition=0 offs |
| 18:59:47.758 | payment-service | INFO | kafka-consumer | Kafka consumed OrderCreated topic=order.created partition=0 offset=21 key=48 |
| 18:59:47.758 | notification-service | INFO | kafka-consumer | Kafka consumed OrderCreated topic=order.created partition=0 offset=21 key=48 |
| 18:59:47.759 | cart-service | INFO | kafka-consumer | Kafka consumed OrderCreated topic=order.created partition=0 offset=21 key=48 |
| 18:59:47.760 | customer-service | INFO | kafka-consumer | Kafka consumed OrderCreated topic=order.created partition=0 offset=21 key=48 |
| 18:59:47.762 | notification-service | INFO | kafka-consumer | Kafka consumed OrderStatusUpdated topic=order.status.updated partition=0 offset=105 key=48 |
| 18:59:47.763 | restaurant-service | INFO | kafka-consumer | Kafka consumed OrderStatusUpdated topic=order.status.updated partition=0 offset=105 key=48 |
| 18:59:47.763 | order-service | INFO | kafka-producer | Kafka published OrderStatusUpdated eventId=040806c0-a505-4d6d-952a-628de701dfbf topic=order.status.updated par |
| 18:59:47.763 | delivery-service | INFO | kafka-consumer | Kafka consumed OrderStatusUpdated topic=order.status.updated partition=0 offset=105 key=48 |
| 18:59:47.763 | customer-service | INFO | kafka-consumer | Kafka consumed OrderStatusUpdated topic=order.status.updated partition=0 offset=105 key=48 |
| 18:59:47.773 | payment-service | DEBUG | payment | [OrderClient#info] ---> GET http://order-service/internal/orders/48 HTTP/1.1 |
| 18:59:47.784 | order-service | DEBUG | application | -> OrderController.info |
| 18:59:47.791 | user-service | INFO | api-request | GET /internal/users/46/contact -> 200 (22 ms) |
| 18:59:47.794 | notification-service | INFO | application | [SANDBOX EMAIL] to=c**********@example.com subject='Order FD20261121-WCFZFT placed' (not actually sent) |
| 18:59:47.796 | order-service | DEBUG | application | OrderQueryService.info(..) took 11 ms |
| 18:59:47.797 | order-service | DEBUG | application | <- info returned OrderInfo |
| 18:59:47.798 | payment-service | DEBUG | payment | [OrderClient#info] <--- HTTP/1.1 200 (24ms) |
| 18:59:47.798 | notification-service | INFO | application | [SANDBOX SMS] to=*********0001 text='Order FD20261121-WCFZFT placed' (not actually sent) |
| 18:59:47.804 | payment-service | INFO | kafka-producer | Outbox: queued PaymentInitiated for topic payment.initiated key=48 eventId=41885e9c-aff4-4dd8-b10c-8f0eb4c3047 |
| 18:59:47.805 | order-service | INFO | api-request | GET /internal/orders/48 -> 200 (26 ms) |
| 18:59:47.805 | payment-service | INFO | payment | Payment 48 initiated for order FD20261121-WCFZFT amount=408.00 provider=SANDBOX sandbox=true |
| 18:59:47.805 | payment-service | DEBUG | application | PaymentService.onOrderCreated(..) took 39 ms |
| 18:59:48.204 | payment-service | INFO | kafka-producer | Kafka published PaymentInitiated eventId=41885e9c-aff4-4dd8-b10c-8f0eb4c3047c topic=payment.initiated partitio |

(83 log lines carried this correlation id; the table shows the request, Kafka and order-lifecycle lines.)

#### b) The Kafka events of the same request (persistent audit store)

| Event time | Kind | Event | Topic / partition@offset | Producer or consumer | Status |
|---|---|---|---|---|---|
| 18:59:47.417 | PUBLISHED | OrderCreated | `order.created` 0@21 | order-service | PUBLISHED |
| 18:59:47.417 | CONSUMED | OrderCreated | `order.created` 0@21 | customer-service / CustomerEventConsumer | PROCESSED |
| 18:59:47.417 | CONSUMED | OrderCreated | `order.created` 0@21 | cart-service / CartEventConsumer | PROCESSED |
| 18:59:47.417 | CONSUMED | OrderCreated | `order.created` 0@21 | notification-service / NotificationEventConsumer | PROCESSED |
| 18:59:47.417 | CONSUMED | OrderCreated | `order.created` 0@21 | payment-service / PaymentEventConsumer | PROCESSED |
| 18:59:47.419 | PUBLISHED | OrderStatusUpdated | `order.status.updated` 0@105 | order-service | PUBLISHED |
| 18:59:47.419 | CONSUMED | OrderStatusUpdated | `order.status.updated` 0@105 | delivery-service / DeliveryEventConsumer | PROCESSED |
| 18:59:47.419 | CONSUMED | OrderStatusUpdated | `order.status.updated` 0@105 | customer-service / CustomerEventConsumer | PROCESSED |
| 18:59:47.419 | CONSUMED | OrderStatusUpdated | `order.status.updated` 0@105 | restaurant-service / RestaurantEventConsumer | PROCESSED |
| 18:59:47.771 | CONSUMED | OrderStatusUpdated | `order.status.updated` 0@105 | notification-service / NotificationEventConsumer | PROCESSED |
| 18:59:47.803 | PUBLISHED | PaymentInitiated | `payment.initiated` 0@21 | payment-service | PUBLISHED |


*How to repeat this yourself:* copy the `X-Correlation-Id` from the response headers of any request (browser dev-tools) and paste it into
**Admin → Log search → Correlation id** (all log lines across services) and into **Admin → Kafka → Message history → Search** (all events of that request).

---

## 16. How it was verified

* `mvn clean install` builds all 18 modules; each service starts on its own port with its own database (Flyway applies `V1__init.sql`, Hibernate runs in `validate` mode).
* `scripts/e2e.py` drives the **real stack through the gateway** (real HTTP, MySQL, Kafka, Redis, Elasticsearch): 166 checks (API, Kafka sagas, caching, security, ELK) plus 29 real-browser UI checks (Playwright + Chrome) all pass on a clean cold start; `scripts/e2e.py` prints `166 checks passed, 0 failed`
* The Angular production build succeeds (`ng build`), the dev server proxies to the gateway.
* Per the project instructions **no unit/integration test suites were written**; verification is the live end-to-end script above.

## 17. Pending items and honest limitations

* **No real payment provider, e-mail or SMS provider is configured**: the `SANDBOX` adapters are clearly labelled; adding a real provider means implementing
  `PaymentProvider` / `NotificationChannel` and setting `food.payment.provider`.
* **Local-development security shortcuts:** Elasticsearch/Kibana run without authentication; Kafka without TLS/ACLs; the MySQL login is in the git-ignored `.env`
  (the Java sources contain no credentials, only `${MYSQL_USER}`/`${MYSQL_PASSWORD}` placeholders).
* **Single-node infrastructure**: Kafka replication factor 1, one Redis, one Elasticsearch node (the configuration is the same shape as production; the numbers are not).
* Stock is tracked per ingredient **only for dishes that have a recipe**; dishes without a recipe are unlimited.
* The shared `uploads/` directory is the dev file store behind `FileStorageService`; production would implement the interface with S3/MinIO.
* Restaurant *staff* accounts exist as a role but there is no staff-to-restaurant assignment screen (the owner operates the restaurant).
* Coupon usage is released only by never counting cancelled orders' redemptions in the *limit* check; an explicit "un-redeem on cancel" event is not implemented.
* The event audit store keeps 14 days by default (`AUDIT_RETENTION_DAYS`).
* Throw-away helper databases created by `scripts/gen-schema.sh` (`*_gen`) can be removed with `scripts/drop-gen-databases.sh`.
