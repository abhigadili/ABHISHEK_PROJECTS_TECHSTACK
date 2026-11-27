# Food Delivery Microservices — Asynchronous (Kafka) + Repository Pattern (R2DBC)

A beginner-friendly walkthrough of how this system was built: four independent
Spring Boot microservices, each owning its own MySQL database, coordinating
with each other **exclusively through Kafka** — no synchronous REST call
exists anywhere between any of the four services — using the Repository
Pattern built on **Spring Data R2DBC** instead of JPA, Hibernate, or plain
JDBC.

Project location: `Documents/Java_Projects/Spring-boot-food-delivery-async-repository-pattern`

---

## 1. The system

A food-delivery platform, split into four services, each owning one database:

| Service | Port | Owns database | Tables |
|---|---|---|---|
| `restaurant-service` | 8095 | `RestaurantDB` | Restaurants, Restaurant_Address, Categories, Menu_Items, Menu_Item_Images, Restaurant_Hours, Restaurant_Ratings, Restaurant_Offers |
| `order-service` | 8098 | `OrderDB` | Orders, Order_Items, Order_Status_History, Customer_Address, Order_Coupons |
| `payment-service` | 8096 | `PaymentDB` | Payments, Payment_Methods, Refunds, Payment_Logs |
| `delivery-service` | 8097 | `DeliveryDB` | Delivery_Partners, Deliveries, Delivery_Status, Delivery_Location_History |

`restaurant-service` is a pure catalog service — nothing in the choreography
below touches it. The other three form a **saga**: placing an order kicks off
a chain of events that flows through payment and delivery without any of the
three ever calling each other's REST APIs.

```
   order-service                payment-service              delivery-service
        │                                                            
  POST /api/orders                                                   
        │  1. save Order (status=PLACED)                             
        │  2. publish OrderCreatedEvent ───► "order-events" topic     
        │                                          │                 
        │                                          ▼                 
        │                              consume OrderCreatedEvent     
        │                              3. save Payment (SUCCESS)     
        │                              4. publish PaymentCompletedEvent
        │                                          │  ───► "payment-events" topic
        │                                          │             │
        ▼ consume PaymentCompletedEvent            │             ▼
  5. Order -> CONFIRMED                            │   consume PaymentCompletedEvent
        │                                          │   6. save Delivery, assign partner
        │                                          │   7. publish DeliveryStatusUpdatedEvent
        │                                          │             │  ───► "delivery-events" topic
        ▼ consume DeliveryStatusUpdatedEvent ◄──────────────────┘
  8. Order -> ASSIGNED
```

This was verified against the real running services: placing an order and
watching `Order_Status_History` fill in — `PLACED` → `CONFIRMED` → `ASSIGNED`
— entirely on its own, roughly one second apart, driven only by Kafka
messages.

---

## 2. Why Spring Data R2DBC instead of JPA/Hibernate/JDBC

The brief for this system explicitly asked to avoid JPA, Hibernate, and even
plain JDBC where possible. Combined with "asynchronous only" as the
system-wide theme, **R2DBC** (Reactive Relational Database Connectivity) was
the natural fit — it's a completely different database access protocol from
JDBC, built from the ground up to be non-blocking:

- **Not JDBC**: R2DBC doesn't use `java.sql.Connection`/`Statement`/`ResultSet`
  at all. It has its own driver SPI, implemented here by
  `io.asyncer:r2dbc-mysql`.
- **Not Hibernate/JPA**: There's no `EntityManager`, no lazy-loading proxies,
  no first/second-level cache, no `@Entity` lifecycle callbacks. Spring Data
  R2DBC is a much thinner layer — it maps a row to a plain object and back,
  nothing more.
- **Repository Pattern still applies**: every table has a one-line
  `ReactiveCrudRepository<T, ID>` interface, exactly like the earlier
  `cricket-universe-springboot` project's `JpaRepository` interfaces — Spring
  Data generates the implementation, and every generated query is bound
  with `?` parameters, never string-concatenated.

Every entity in this project is a **Java `record`**, not a class with
getters/setters:

```java
@Table("Restaurants")
public record Restaurant(
        @Id Long restaurantId,
        @NotNull Long categoryId,
        @NotBlank String name,
        ...
        @ReadOnlyProperty LocalDateTime createdAt,
        @ReadOnlyProperty LocalDateTime updatedAt
) {}
```

Records work naturally with Spring Data R2DBC: field names are converted to
snake_case column names automatically (`restaurantId` → `restaurant_id`), and
after an insert, Spring Data constructs a *new* record instance with the
database-generated id filled in — there's no mutation, because records can't
be mutated.

Every controller in every service is **reactive** end to end
(`spring-boot-starter-webflux`, `Mono`/`Flux` return types) — a `GET`
request never blocks a thread waiting on the database; the R2DBC driver and
the HTTP server share the same non-blocking I/O model.

---

## 3. A real bug: `@ReadOnlyProperty` and DB-managed timestamps

Every table has `created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP` (and some
have `updated_at ... ON UPDATE CURRENT_TIMESTAMP`). The first version of this
code passed `null` for those fields when building a new record to insert.
That seemed reasonable — but R2DBC's generated `INSERT` statement includes
**every** column from the entity, including ones with a `null` Java value,
which means it was inserting a literal SQL `NULL`, not deferring to MySQL's
own `DEFAULT` clause.

Fixed with `@ReadOnlyProperty` (from `org.springframework.data.annotation`)
on every DB-managed timestamp field:

```java
@ReadOnlyProperty
LocalDateTime createdAt,

@ReadOnlyProperty
LocalDateTime updatedAt
```

This tells Spring Data R2DBC to exclude the field from every `INSERT` and
`UPDATE` statement it generates entirely — the column is simply never
mentioned, so MySQL's own `DEFAULT CURRENT_TIMESTAMP` / `ON UPDATE
CURRENT_TIMESTAMP` clauses take over exactly as they would from a raw `INSERT
INTO table (other, columns) VALUES (...)` with `created_at` omitted.

**A second, related bug this uncovered:** `save()` for a brand-new row only
returns the object with the generated **id** merged in — it does not
re-`SELECT` the row, so a freshly-inserted `Restaurant` object still showed
`createdAt: null` in the API response, even after the `@ReadOnlyProperty`
fix, because the in-memory object was never told what MySQL actually chose
for that column. Every `create()` method in this codebase now re-fetches
after saving:

```java
return restaurantRepository.save(toSave)
        .flatMap(saved -> restaurantRepository.findById(saved.restaurantId()));
```

This was caught by actually calling `POST /api/restaurants` and reading the
JSON response — the timestamps were silently missing until this fix, a
mistake that would never show up from reading the code or from a compiler.

---

## 4. Setting up Kafka for this project

This machine already had a Kafka broker running (via Docker), but it turned
out to be a very old version (Kafka 1.0.1, from 2017). A direct connectivity
test with the modern `kafka-clients`/`spring-kafka` versions this project
needs (`kafka-clients` 3.8.x) **failed outright** — `AdminClient.listTopics()`
timed out with "waiting for a node assignment," a protocol-handshake
incompatibility between a client that new and a broker that old.

Per explicit confirmation, a **new, separate Kafka broker** was started in
Docker specifically for this project, leaving the existing one untouched:

```bash
docker run -d --name food-delivery-kafka \
  -p 9094:9094 \
  -e KAFKA_NODE_ID=1 \
  -e KAFKA_PROCESS_ROLES=broker,controller \
  -e KAFKA_LISTENERS=PLAINTEXT://0.0.0.0:9092,CONTROLLER://0.0.0.0:9093,EXTERNAL://0.0.0.0:9094 \
  -e KAFKA_ADVERTISED_LISTENERS=PLAINTEXT://localhost:9092,EXTERNAL://localhost:9094 \
  -e KAFKA_LISTENER_SECURITY_PROTOCOL_MAP=CONTROLLER:PLAINTEXT,PLAINTEXT:PLAINTEXT,EXTERNAL:PLAINTEXT \
  -e KAFKA_CONTROLLER_QUORUM_VOTERS=1@localhost:9093 \
  -e KAFKA_CONTROLLER_LISTENER_NAMES=CONTROLLER \
  -e KAFKA_INTER_BROKER_LISTENER_NAME=PLAINTEXT \
  -e CLUSTER_ID=ZmZmZmZmZmZmZmZmZmZmZm \
  -e KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR=1 \
  -e KAFKA_AUTO_CREATE_TOPICS_ENABLE=true \
  apache/kafka:latest
```

This is the official `apache/kafka` image running in **KRaft mode** (no
separate ZooKeeper container needed — modern Kafka can run its own metadata
quorum). It listens on **port 9094** externally, deliberately different from
the existing broker's 9092, so both can run side by side without conflict.

All four services point at it via `spring.kafka.bootstrap-servers`, itself
overridable by an environment variable:

```properties
spring.kafka.bootstrap-servers=${KAFKA_BOOTSTRAP_SERVERS:localhost:9094}
```

**Managing this container:**
```bash
docker stop food-delivery-kafka     # stop it
docker start food-delivery-kafka    # start it again (data persists in the container)
docker rm -f food-delivery-kafka    # remove it entirely
```

---

## 5. Kafka topics and events

| Topic | Producer | Consumer(s) | Payload |
|---|---|---|---|
| `order-events` | order-service | payment-service | `OrderCreatedEvent` |
| `payment-events` | payment-service | order-service, delivery-service | `PaymentCompletedEvent` |
| `delivery-events` | delivery-service | order-service | `DeliveryStatusUpdatedEvent` |

Each service declares the topic(s) *it produces to* as a `NewTopic` bean
(self-documenting, in addition to the broker's own auto-create setting):

```java
@Bean
public NewTopic paymentEventsTopic(@Value("${kafka.topic.payment-events}") String topicName) {
    return TopicBuilder.name(topicName).partitions(1).replicas(1).build();
}
```

**Every event class is duplicated, once per service that needs it** — there
is no shared "events" library. `OrderCreatedEvent` exists as
`com.fooddelivery.order.event.OrderCreatedEvent` (the producer's copy) *and*
`com.fooddelivery.payment.event.OrderCreatedEvent` (the consumer's copy) —
same JSON shape, two independent Java types in two independently-deployed
codebases. This is deliberate: it means `order-service` can add a field
`payment-service` doesn't care about without needing to redeploy
`payment-service` in lock-step.

---

## 6. A real bug: cross-service event deserialization

The first attempt at wiring the Kafka consumer used Spring's defaults for
`spring-kafka`'s `JsonSerializer`/`JsonDeserializer`. Publishing a test
message and watching `payment-service` try to consume it produced:

```
IllegalStateException: No type information in headers and no default type provided
```

Here's why: by default, `JsonSerializer` writes the **producer's own
fully-qualified class name** into a `__TypeId__` Kafka header (e.g.
`com.fooddelivery.order.event.OrderCreatedEvent`), and `JsonDeserializer`
tries to `Class.forName()` that exact name on the consumer's classpath. But
`payment-service` has its own **separate** class,
`com.fooddelivery.payment.event.OrderCreatedEvent` — the producer's class
doesn't exist in the consumer's JAR at all. This is exactly the trap that
independently-versioned event DTOs fall into if you don't configure around
it.

**The fix**, applied on every consumer, was to stop relying on headers
entirely and always deserialize into the consumer's own known type:

```properties
spring.kafka.consumer.properties.spring.json.use.type.headers=false
spring.kafka.consumer.properties.spring.json.value.default.type=com.fooddelivery.payment.event.OrderCreatedEvent
```

And on the producer side, stop writing a header nobody uses:

```properties
spring.kafka.producer.properties.spring.json.add.type.headers=false
```

This was verified by publishing a plain, header-free JSON message directly
onto the `order-events` topic with a throwaway `kafka-clients` producer and
confirming `payment-service` picked it up, processed it, and published
`PaymentCompletedEvent` — all without a single type-related error.

### order-service's special case: two event shapes, two topics

`order-service` is the only service that consumes **two different event
types** (`PaymentCompletedEvent` and `DeliveryStatusUpdatedEvent`) from two
different topics. A single `spring.kafka.consumer.value-default-type`
property can't express "use type A for topic X and type B for topic Y" —
Spring Boot's one autoconfigured consumer factory only knows one default
type. The fix was to define **two separate consumer factories** by hand:

```java
@Bean
public ConsumerFactory<String, Object> paymentEventsConsumerFactory() {
    return buildConsumerFactory(PaymentCompletedEvent.class);
}

@Bean
public ConcurrentKafkaListenerContainerFactory<String, Object> paymentEventsContainerFactory(
        ConsumerFactory<String, Object> paymentEventsConsumerFactory) {
    ConcurrentKafkaListenerContainerFactory<String, Object> factory = new ConcurrentKafkaListenerContainerFactory<>();
    factory.setConsumerFactory(paymentEventsConsumerFactory);
    return factory;
}
// ...same pattern for deliveryEventsConsumerFactory / deliveryEventsContainerFactory
```

and pointed each `@KafkaListener` at the matching factory:

```java
@KafkaListener(
        topics = "${kafka.topic.payment-events}",
        groupId = "${spring.kafka.consumer.group-id}",
        containerFactory = "paymentEventsContainerFactory")
public void onPaymentCompleted(PaymentCompletedEvent event) { ... }
```

---

## 7. Bridging Kafka's blocking listener with reactive R2DBC

`@KafkaListener` methods run on Spring Kafka's own dedicated consumer
thread — never on the Netty event-loop threads WebFlux controllers use for
HTTP traffic. That means calling `.block()` inside a listener method to wait
for a reactive R2DBC pipeline to finish is **safe** here; it does not starve
the HTTP server the way blocking inside a WebFlux controller would:

```java
@KafkaListener(topics = "${kafka.topic.order-events}", groupId = "${spring.kafka.consumer.group-id}")
public void onOrderCreated(OrderCreatedEvent event) {
    paymentService.processOrderPayment(event).block();
}
```

This is the standard, pragmatic way to combine classic `spring-kafka`
listeners with a reactive downstream. The fully non-blocking alternative —
Project Reactor's dedicated **Reactor Kafka** library — trades this
simplicity for an end-to-end reactive consume loop, useful at much higher
throughput than a learning project like this one needs.

---

## 8. Eventual consistency and what each service is allowed to know

`Deliveries.pickup_address` and `Deliveries.drop_address` are plain text
columns, not foreign keys. `delivery-service` needs a human-readable pickup
location (the restaurant) and drop location (the customer's address), but it
has no synchronous way to ask `restaurant-service` or `order-service` for
that text — this system doesn't allow synchronous calls at all.

The solution: **each service enriches the event with whatever data it
already owns**, and passes the rest along as an opaque string:

- `order-service` owns `Customer_Address` in its own database, so it looks
  up the real address text and puts it in `OrderCreatedEvent.deliveryAddressText`.
- `payment-service` doesn't know or care what that string means — it just
  copies it through into `PaymentCompletedEvent.deliveryAddressText`.
- `delivery-service` receives it as a ready-made string and uses it directly
  as `dropAddress`. For the pickup side, it only has a bare `restaurantId`
  (nobody enriched a restaurant name/address into the event), so it falls
  back to a generic `"Restaurant #" + restaurantId` label.

This is a real, common microservices trade-off: an event carries whatever
its producer can cheaply provide, not a fully resolved view of the world. A
"better" pickup address would require `restaurant-service` to also
participate in some way — out of scope here, but worth knowing this is a
deliberate simplification, not an oversight.

---

## 9. How SQL injection is prevented

Every repository in all four services is a `ReactiveCrudRepository`
interface — Spring Data R2DBC generates the SQL for every method (including
derived finders like `findByRestaurantId(Long id)`) with bound `?`
parameters, never string concatenation. There is no hand-written SQL
anywhere in this codebase.

As with the earlier microservices project in this workspace, every
cross-reference here is a `Long`, never a free-text search string, which
means Spring WebFlux's own request parameter binding rejects a malformed
value **before it ever reaches a repository**:

```bash
curl "http://localhost:8098/api/orders/1' OR '1'='1"
# -> 400 Bad Request
#    "Invalid request input: Type mismatch."
```

This was verified against all four running services. After every test —
including this one — row counts in all four databases were re-checked
against MySQL directly and matched exactly what the legitimate CRUD calls in
this session should have produced; nothing was altered outside the expected
inserts and their subsequent cleanup.

**The rule that makes this hold everywhere in this codebase:** every
database call goes through Spring Data R2DBC's generated, parameter-bound
queries. No service builds a SQL string by hand, and no endpoint accepts a
free-text value that gets spliced into a `WHERE` clause.

---

## 10. Verifying the build and the full choreography

```bash
cd Documents/Java_Projects/Spring-boot-food-delivery-async-repository-pattern
mvn clean package        # BUILD SUCCESS across all 4 modules
```

With the Kafka container and all four services running, this end-to-end
sequence was executed against the live system:

```bash
curl -X POST http://localhost:8098/api/orders -d '{
  "customerId":1,"restaurantId":1,"deliveryAddressId":1,
  "totalAmount":450.00,"deliveryFee":40.00,"finalAmount":490.00
}'
# -> 201 Created, orderStatus: "PLACED"

# ~2 seconds later, with no further action from the caller:
curl "http://localhost:8098/api/order-status-history?orderId=4"
# -> PLACED, then CONFIRMED ("Payment successful (ref TXN-...)"),
#    then ASSIGNED ("Assigned to Ravi Kumar") — three rows, each
#    written by a different service, none of them called directly
#    by the client or by each other.

curl "http://localhost:8096/api/payments?orderId=4"
# -> a real Payment row, amount matching the order's finalAmount

curl "http://localhost:8097/api/deliveries?orderId=4"
# -> a real Delivery row, dropAddress correctly built from
#    order-service's own Customer_Address data
```

Also verified individually per service before the combined run: full CRUD on
every one of the 21 tables, the `@ReadOnlyProperty`/re-fetch timestamp fix,
the cross-service event deserialization fix (including a raw, header-free
Kafka message test), and the SQL-injection-style request above.

---

## 11. Running it yourself

```bash
# 1. Start a Kafka broker (see §4) if the food-delivery-kafka container isn't already running
docker start food-delivery-kafka   # or the full `docker run ...` command in §4 if it doesn't exist yet

# 2. Load schema + sample data (run once)
mysql -u <user> -p < sql/01_restaurant_db.sql
mysql -u <user> -p < sql/02_order_db.sql
mysql -u <user> -p < sql/03_delivery_db.sql
mysql -u <user> -p < sql/04_payment_db.sql

# 3. Build everything
mvn clean package

# 4. Start each service (any order — each one is independently runnable;
#    the choreography only fires once you place an order via order-service)
java -jar restaurant-service/target/restaurant-service.jar   # :8095
java -jar payment-service/target/payment-service.jar          # :8096
java -jar delivery-service/target/delivery-service.jar        # :8097
java -jar order-service/target/order-service.jar              # :8098
```

DB credentials and the Kafka bootstrap address are all externalised via
environment variables (`DB_USERNAME`, `DB_PASSWORD`, `KAFKA_BOOTSTRAP_SERVERS`)
with sane localhost defaults in each `application.properties`.

---

## 12. Key takeaways for a beginner

1. **"Asynchronous" and "non-blocking" are related but different axes.**
   Kafka makes *inter-service communication* asynchronous (a producer never
   waits for a consumer). R2DBC makes *database access within one service*
   non-blocking. This project uses both, but they're solving different
   problems — you could use R2DBC with synchronous inter-service calls, or
   Kafka with a blocking JDBC database layer, just as validly.
2. **A framework default (`JsonSerializer`'s type headers) can silently
   assume something that isn't true in a real microservices deployment** —
   that the consumer has the exact same class as the producer. It doesn't,
   by design, once each service owns its own copy of an event's shape.
   Always check whether a serialization default is compatible with your
   deployment topology, not just whether it compiles.
3. **`save()` returning "success" doesn't mean the returned object reflects
   everything the database actually did.** DB-side defaults
   (`DEFAULT CURRENT_TIMESTAMP`, auto-increment) may need an explicit
   re-fetch if your API response should show them accurately.
4. **Events should carry what their producer already knows, not a fully
   resolved snapshot of the whole system.** Designing what belongs in an
   event payload is itself an architectural decision with real trade-offs —
   here, it meant a generic placeholder pickup address rather than a
   synchronous lookup, which is exactly the point of an asynchronous-only
   system.
5. **A Kafka listener thread is not an HTTP request thread.** Blocking
   inside `@KafkaListener` to bridge into reactive code is a safe, common
   pattern — the two thread pools are already separate by design.
