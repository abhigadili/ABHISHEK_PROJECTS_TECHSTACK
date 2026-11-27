# From Kafka to RabbitMQ — Food Delivery Microservices, Beginner's Guide

This document explains, from scratch, how the `rabbitmq-sboot-food-delivery-async-repository-pattern`
project was converted from Apache Kafka to RabbitMQ, how to build it, how to
run every service, and — most importantly for a beginner — **how to prove to
yourself that a message was actually produced, queued, delivered and
consumed**, with real commands and real output captured from this machine.

No prior RabbitMQ knowledge is assumed. Kafka terms are used as reference
points throughout because the previous version of this same system used
Kafka, and the two technologies solve the same problem in different ways.

---

## 1. What this system is

Four independent Spring Boot microservices, each owning its own MySQL
database, talking to each other **only** through asynchronous messages —
never through direct REST calls:

| Service | Port | Owns (MySQL DB) | Role |
|---|---|---|---|
| `restaurant-service` | 8095 | RestaurantDB | Pure catalog CRUD. No messaging at all. |
| `order-service` | 8098 | OrderDB | Publishes `OrderCreatedEvent` when a customer places an order. Consumes `PaymentCompletedEvent` and `DeliveryStatusUpdatedEvent` to update order status. |
| `payment-service` | 8096 | PaymentDB | Consumes `OrderCreatedEvent`, "processes" a payment, publishes `PaymentCompletedEvent`. |
| `delivery-service` | 8097 | DeliveryDB | Consumes `PaymentCompletedEvent`, assigns a delivery partner, publishes `DeliveryStatusUpdatedEvent`. |

Every database access goes through **Spring Data R2DBC** (non-blocking,
no JPA/Hibernate/JDBC) — that part was untouched by this conversion.

The only thing that changed is **how the four services talk to each other**:
Kafka topics were replaced with RabbitMQ exchanges, queues and bindings.

---

## 2. Why this conversion was non-trivial: Kafka vs RabbitMQ concepts

A Kafka **topic** and a RabbitMQ **exchange** are *not* the same kind of
object, even though both are commonly used to explain "pub/sub". This
mapping is what actually drove the code changes:

| Kafka concept | RabbitMQ equivalent used here | Why |
|---|---|---|
| Topic (e.g. `order-events`) | `TopicExchange` (e.g. `order-events.exchange`) | The exchange routes messages; it does not store them. |
| Partition offset per consumer group | A dedicated `Queue` per consuming service | RabbitMQ has no concept of "replaying from an offset" — each independent consumer needs its **own queue** bound to the exchange so it gets every message regardless of what other consumers are doing. |
| Producer sends `(topic, key, value)` | Producer sends `(exchange, routingKey, payload)` via `RabbitTemplate.convertAndSend()` | Routing key replaces the partition key; here it is just a fixed string per event type (e.g. `order.created`). |
| `@KafkaListener(topics=..., groupId=...)` | `@RabbitListener(queues=...)` | You listen on a **queue** in RabbitMQ, not on the exchange directly. |
| `NewTopic` bean (auto-create topic on startup) | `Queue`/`TopicExchange`/`Binding` beans (auto-declared by RabbitAdmin on startup) | Same idea — declare your topology in code instead of relying on manual broker setup. |
| `spring.kafka.consumer.properties.spring.json.value.default.type` | `Jackson2JsonMessageConverter` + `DefaultClassMapper.setDefaultType(...)` | Both exist because each service defines its **own local copy** of the same event record in its own package — nobody shares a "common events" library. |

### The topology that was designed for this system

Three topic exchanges, one per event type, each with one queue per
independent consumer (mirroring how multiple Kafka consumer groups each read
every message from a topic):

```
order-service  --publish--> [order-events.exchange]  --routing key "order.created"-->
                                                          -> payment-service.order-events.queue --> payment-service

payment-service --publish--> [payment-events.exchange] --routing key "payment.completed"-->
                                                          -> order-service.payment-events.queue    --> order-service
                                                          -> delivery-service.payment-events.queue --> delivery-service

delivery-service --publish--> [delivery-events.exchange] --routing key "delivery.status-updated"-->
                                                          -> order-service.delivery-events.queue --> order-service
```

Notice `payment-events.exchange` fans out to **two** separate queues — one
per consumer — which is exactly how a Kafka topic with two independent
consumer groups behaves: every consumer gets every message.

---

## 3. Code changes made, file by file

### 3.1 `pom.xml` (root + all 3 messaging services)

Removed:
```xml
<dependency>
    <groupId>org.springframework.kafka</groupId>
    <artifactId>spring-kafka</artifactId>
</dependency>
<!-- and, in test scope -->
<dependency>
    <groupId>org.springframework.kafka</groupId>
    <artifactId>spring-kafka-test</artifactId>
    <scope>test</scope>
</dependency>
```

Added:
```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-amqp</artifactId>
</dependency>
<!-- and, in test scope -->
<dependency>
    <groupId>org.springframework.amqp</groupId>
    <artifactId>spring-rabbit-test</artifactId>
    <scope>test</scope>
</dependency>
```

`restaurant-service` was untouched — it never had any Kafka dependency
because it has no messaging.

### 3.2 Config classes

| Old file (Kafka) | New file (RabbitMQ) | What it does |
|---|---|---|
| `order-service/config/KafkaTopicConfig.java` | `order-service/config/RabbitMQConfig.java` | Declares exchanges, queues and bindings, plus a `MessageConverter` bean for the producer side. |
| `order-service/config/KafkaConsumerConfig.java` | `order-service/config/RabbitConsumerConfig.java` | Two `SimpleRabbitListenerContainerFactory` beans — order-service is the only service consuming **two different event shapes**, so it needs two converters, one per target Java type. |
| `payment-service/config/KafkaTopicConfig.java` | `payment-service/config/RabbitMQConfig.java` | Topology + a single `MessageConverter` bean (only one event shape consumed). |
| `delivery-service/config/KafkaTopicConfig.java` | `delivery-service/config/RabbitMQConfig.java` | Same pattern as payment-service. |

### 3.3 Producers

Every `*EventProducer` class swapped `KafkaTemplate<String,Object>.send(topic, key, event)`
for `RabbitTemplate.convertAndSend(exchange, routingKey, event)`.

### 3.4 Listeners

Every `@KafkaListener(topics = "...", groupId = "...")` became
`@RabbitListener(queues = "...")` (order-service's two listeners also keep
their `containerFactory = "..."` attribute, exactly as they did for Kafka).

### 3.5 `application.properties`

`spring.kafka.*` and `kafka.topic.*` properties were replaced with
`spring.rabbitmq.*` (host/port/username/password) and custom
`rabbitmq.exchange.*` / `rabbitmq.queue.*` / `rabbitmq.routing-key.*`
properties — one set per event type, matching only what each service
actually needs (a producer doesn't need a queue name; a consumer doesn't
need to declare a routing key it isn't publishing under, etc).

---

## 4. A real bug hit during this conversion (and the fix)

This is worth documenting because it is the single most common gotcha when
moving from Kafka's `spring-kafka` to Spring AMQP's `spring-rabbit`, and
running into it live proves the system was actually tested, not just typed.

**Symptom** — placing an order returned `HTTP 400`:
```
"SimpleMessageConverter only supports String, byte[] and Serializable
payloads, received: com.fooddelivery.order.event.OrderCreatedEvent"
```
**Cause 1**: unlike `KafkaTemplate`, Spring Boot's autoconfigured
`RabbitTemplate` defaults to a plain `SimpleMessageConverter` unless a
`MessageConverter` bean exists in the application context. order-service's
two listener-side converters were scoped to their container factories only —
no general-purpose converter existed for the *producer* side. **Fix**:
added a plain `Jackson2JsonMessageConverter` `@Bean` to
`order-service/config/RabbitMQConfig.java`.

**Symptom 2**, after fixing #1 — payment-service's consumer immediately
crashed on the very next message with:
```
IllegalArgumentException: The class 'com.fooddelivery.order.event.OrderCreatedEvent'
is not in the trusted packages: [java.util, java.lang].
```
**Cause 2**: `Jackson2JsonMessageConverter` stamps every outgoing message
with a `__TypeId__` header containing the **producer's** fully-qualified
class name. order-service's `OrderCreatedEvent` and payment-service's
*own, separate* `OrderCreatedEvent` live in different packages by design
(no shared "contracts" library between services) — so the header pointed at
a class that doesn't even exist on payment-service's classpath, and
RabbitMQ's default trusted-package allow-list rejected it besides.

**Fix**: `converter.setAlwaysConvertToInferredType(true)` on every consumer
converter. This tells Spring AMQP to **ignore the producer's type header
entirely** and always deserialize into whatever type the target
`@RabbitListener` method declares — the RabbitMQ equivalent of Kafka's
`spring.json.use.type.headers=false` + `value.default.type=...` combination
used in the original Kafka setup.

Both fixes are now baked into `RabbitMQConfig.java` / `RabbitConsumerConfig.java`
in all three messaging services, with comments explaining why.

---

## 5. Prerequisites checked on this machine

```bash
$ java -version
openjdk version "21.0.7" 2025-04-15

$ mvn -version
Apache Maven 3.8.6

$ docker ps --format '{{.Names}}\t{{.Image}}\t{{.Ports}}' | grep rabbitmq
docker-rabbitmq-1   rabbitmq:3.7.8-management   0.0.0.0:5672->5672/tcp, 0.0.0.0:15672->15672/tcp

$ mysql -h127.0.0.1 -uabhig -p'Pass@123' -e "show databases;" | grep -E "OrderDB|PaymentDB|DeliveryDB|RestaurantDB"
OrderDB
PaymentDB
DeliveryDB
RestaurantDB
```

RabbitMQ default credentials on this broker are `guest` / `guest`
(management UI at `http://localhost:15672`).

---

## 6. Building the project

From the project root (the folder containing the parent `pom.xml`):

```bash
cd rabbitmq-sboot-food-delivery-async-repository-pattern
mvn clean package -DskipTests
```

Actual output from this machine:

```
[INFO] ------------------------------------------------------------------------
[INFO] Reactor Summary for Food Delivery Microservices (Asynchronous, Repository Pattern) 1.0.0:
[INFO]
[INFO] Food Delivery Microservices (Asynchronous, Repository Pattern) SUCCESS [  0.058 s]
[INFO] restaurant-service ................................. SUCCESS [  2.533 s]
[INFO] payment-service .................................... SUCCESS [  0.824 s]
[INFO] delivery-service ................................... SUCCESS [  0.682 s]
[INFO] order-service ...................................... SUCCESS [  0.599 s]
[INFO] ------------------------------------------------------------------------
[INFO] BUILD SUCCESS
[INFO] ------------------------------------------------------------------------
```

This produces one runnable fat jar per service:

```
restaurant-service/target/restaurant-service.jar
payment-service/target/payment-service.jar
delivery-service/target/delivery-service.jar
order-service/target/order-service.jar
```

You can confirm RabbitMQ (and not Kafka) is actually bundled inside a jar:

```bash
$ unzip -l order-service/target/order-service.jar | grep -E "spring-rabbit|spring-kafka"
   628184  BOOT-INF/lib/spring-rabbit-3.2.2.jar
   162345  BOOT-INF/lib/spring-amqp-3.2.2.jar
# (no spring-kafka jar present)
```

---

## 7. Running the services

Order does not strictly matter for RabbitMQ connectivity (RabbitAdmin
retries), but starting `restaurant-service` first and `order-service` last
mirrors the dependency direction of the business flow and avoids the order
API failing simply because the restaurant catalog isn't there yet.

```bash
java -jar restaurant-service/target/restaurant-service.jar &
java -jar payment-service/target/payment-service.jar &
java -jar delivery-service/target/delivery-service.jar &
java -jar order-service/target/order-service.jar &
```

Each service logs its own startup and RabbitMQ connection. Real log excerpt
from payment-service on this machine:

```
Netty started on port 8096 (http)
Attempting to connect to: [localhost:5672]
Created new connection: rabbitConnectionFactory#...:0/SimpleConnection@... [delegate=amqp://guest@127.0.0.1:5672/, ...]
Started PaymentServiceApplication in 2.695 seconds
```

Confirm all four are listening:

```bash
$ curl -s -o /dev/null -w "%{http_code}" http://localhost:8095/api/restaurants   # 200
$ curl -s -o /dev/null -w "%{http_code}" http://localhost:8096/api/payments      # 200
$ curl -s -o /dev/null -w "%{http_code}" http://localhost:8097/api/deliveries    # 200
$ curl -s -o /dev/null -w "%{http_code}" http://localhost:8098/api/orders        # 200
```

---

## 8. Proving the RabbitMQ topology exists

Once all three messaging services have started at least once, RabbitAdmin
will have auto-declared everything. Verify with `rabbitmqctl` (run inside
the RabbitMQ container, or via the management UI at
`http://localhost:15672`, default login `guest`/`guest`):

```bash
$ docker exec <rabbitmq-container> rabbitmqctl list_exchanges name type | grep events
payment-events.exchange     topic
order-events.exchange       topic
delivery-events.exchange    topic

$ docker exec <rabbitmq-container> rabbitmqctl list_queues name messages consumers | grep events
payment-service.order-events.queue     0   1
order-service.delivery-events.queue    0   1
delivery-service.payment-events.queue  0   1
order-service.payment-events.queue     0   1

$ docker exec <rabbitmq-container> rabbitmqctl list_bindings source_name destination_name routing_key | grep events
delivery-events.exchange   order-service.delivery-events.queue      delivery.status-updated
order-events.exchange      payment-service.order-events.queue       order.created
payment-events.exchange    delivery-service.payment-events.queue    payment.completed
payment-events.exchange    order-service.payment-events.queue       payment.completed
```

Every queue shows `consumers = 1` — that's the corresponding service's
`@RabbitListener` actively subscribed and waiting.

---

## 9. End-to-end test: placing a real order and watching it flow

This is the important part for a beginner: **how do you actually know a
message was produced, queued, delivered, and processed?** Four independent
signals, all checked together below.

### 9.1 Fire the request (the only HTTP call in the entire flow)

```bash
curl -s -X POST http://localhost:8098/api/orders \
  -H "Content-Type: application/json" \
  -d '{
    "customerId": 2,
    "restaurantId": 2,
    "deliveryAddressId": 2,
    "totalAmount": 620.00,
    "discountAmount": 20.00,
    "deliveryFee": 25.00,
    "finalAmount": 625.00
  }'
```

Immediate response — note `orderStatus` is `PLACED`, nothing downstream has
happened *yet*:

```json
{
    "orderId": 9,
    "customerId": 2,
    "restaurantId": 2,
    "deliveryAddressId": 2,
    "orderStatus": "PLACED",
    "totalAmount": 620.0,
    "discountAmount": 20.0,
    "deliveryFee": 25.0,
    "finalAmount": 625.0,
    "placedAt": "2026-07-02T12:40:32",
    "updatedAt": "2026-07-02T12:40:32"
}
```

### 9.2 Signal 1 — the producer log line (message was produced)

```
order-service   : Publishing OrderCreatedEvent for order 9
```

### 9.3 Signal 2 — the consumer log lines, in causal order (message was delivered and processed)

```
payment-service  : Received OrderCreatedEvent for order 9
payment-service  : Publishing PaymentCompletedEvent for order 9 (status=SUCCESS)
payment-service  : Finished processing payment for order 9

delivery-service : Received PaymentCompletedEvent for order 9 (status=SUCCESS)
delivery-service : Publishing DeliveryStatusUpdatedEvent for order 9 (status=ASSIGNED)
delivery-service : Finished processing delivery assignment for order 9

order-service    : Received PaymentCompletedEvent for order 9
order-service    : Order 9 updated from payment result
order-service    : Received DeliveryStatusUpdatedEvent for order 9 (status=ASSIGNED)
order-service    : Order 9 updated from delivery status
```

Every "Received" line only exists because a `@RabbitListener` successfully
pulled a message off its queue and Jackson successfully deserialized it into
the expected Java record — this is the proof of successful **consumption**.

### 9.4 Signal 3 — RabbitMQ queue depth returns to zero (message was drained)

```bash
$ docker exec <rabbitmq-container> rabbitmqctl list_queues name messages | grep events
payment-service.order-events.queue      0
order-service.delivery-events.queue     0
delivery-service.payment-events.queue   0
order-service.payment-events.queue      0
```

If a queue's `messages` count stays above 0 and climbs, that queue's
consumer is broken (crashing on every delivery, RabbitMQ keeps requeuing).
If it briefly spikes then returns to 0, that's healthy processing.

### 9.5 Signal 4 — the database rows across all three services (message was fully processed, not just received)

```bash
$ curl -s http://localhost:8098/api/orders/9 | python3 -m json.tool
{
    "orderId": 9,
    "orderStatus": "ASSIGNED",
    ...
}

$ mysql -h127.0.0.1 -uabhig -p'Pass@123' OrderDB \
    -e "select * from Order_Status_History where order_id=9;"
history_id  order_id  status     notes                              changed_at
24          9         PLACED     Order placed by customer          2026-07-02 12:40:32
25          9         CONFIRMED  Payment successful (ref TXN-71241F00)  2026-07-02 12:40:32
26          9         ASSIGNED   Assigned to Sunita Devi           2026-07-02 12:40:32

$ mysql -h127.0.0.1 -uabhig -p'Pass@123' PaymentDB \
    -e "select payment_id,order_id,status,transaction_ref from Payments where order_id=9;"
payment_id  order_id  status   transaction_ref
9           9         SUCCESS  TXN-71241F00

$ mysql -h127.0.0.1 -uabhig -p'Pass@123' DeliveryDB \
    -e "select delivery_id,order_id,partner_id,status from Deliveries where order_id=9;"
delivery_id  order_id  partner_id  status
9            9         2           ASSIGNED
```

All three databases independently agree on what happened, purely from
reacting to messages — **no service ever called another service's HTTP
API**. That's the whole point of this architecture, and it's exactly as
true under RabbitMQ as it was under Kafka.

---

## 10. Quick reference — commands used in this session

```bash
# Build everything
mvn clean package -DskipTests

# Start (one at a time, each in the background)
java -jar restaurant-service/target/restaurant-service.jar &
java -jar payment-service/target/payment-service.jar &
java -jar delivery-service/target/delivery-service.jar &
java -jar order-service/target/order-service.jar &

# Place an order (triggers the whole async chain)
curl -X POST http://localhost:8098/api/orders -H "Content-Type: application/json" -d '{...}'

# Watch it happen
docker exec <rabbitmq-container> rabbitmqctl list_queues name messages consumers
docker exec <rabbitmq-container> rabbitmqctl list_exchanges name type
docker exec <rabbitmq-container> rabbitmqctl list_bindings source_name destination_name routing_key

# Or visually: http://localhost:15672 (guest/guest) -> Queues tab -> click a queue -> "Get messages"

# Verify final state
curl http://localhost:8098/api/orders/<id>
mysql -h127.0.0.1 -uabhig -p'Pass@123' OrderDB -e "select * from Order_Status_History where order_id=<id>;"

# Stop everything
pkill -f "restaurant-service.jar"
pkill -f "payment-service.jar"
pkill -f "delivery-service.jar"
pkill -f "order-service.jar"
```

---

## 11. Troubleshooting checklist for beginners

| Symptom | Likely cause | Where to look |
|---|---|---|
| `Connection refused` on startup | RabbitMQ broker not running / wrong host-port | `docker ps`, `spring.rabbitmq.host/port` in `application.properties` |
| `SimpleMessageConverter only supports String, byte[]...` | No `MessageConverter` bean wired to `RabbitTemplate` | Add a `Jackson2JsonMessageConverter` `@Bean` in that service's `RabbitMQConfig` |
| `not in the trusted packages` | Consumer trying to trust the producer's own class name from the `__TypeId__` header | Set `converter.setAlwaysConvertToInferredType(true)` on the consumer's converter |
| Queue `messages` count keeps growing | The listener is throwing an exception on every message (RabbitMQ requeues by default) | `docker exec <container> rabbitmqctl list_queues name messages`, then check that service's log for a stack trace |
| Order stuck on `PLACED` forever | payment-service isn't running, or its queue has 0 consumers | `rabbitmqctl list_queues name consumers`, restart payment-service |
| Order reaches `CONFIRMED` but never `ASSIGNED` | delivery-service isn't running, or all `Delivery_Partners.is_available = 0` | Check delivery-service logs for "No available delivery partner" |

---

## 12. Summary

- Kafka topics → RabbitMQ topic exchanges; Kafka consumer groups → one
  dedicated RabbitMQ queue per consuming service, bound to the exchange.
- `KafkaTemplate` → `RabbitTemplate`; `@KafkaListener` → `@RabbitListener`.
- The one real trap when moving off Kafka's JSON serializer is the
  `__TypeId__` header — fixed everywhere with `setAlwaysConvertToInferredType(true)`.
- The Repository pattern (Spring Data R2DBC, one database per service, no
  synchronous inter-service calls) was untouched — only the transport
  connecting the four services changed.
- End-to-end proof was captured at four independent levels: producer log →
  consumer log → RabbitMQ queue depth → final database rows across three
  separate databases, all agreeing.
