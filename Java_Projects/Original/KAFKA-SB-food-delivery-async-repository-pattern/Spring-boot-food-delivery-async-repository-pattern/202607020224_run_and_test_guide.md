# Run & Test Guide — Food Delivery Microservices (Kafka + R2DBC)

Everything needed to build, start, and **prove** this system's asynchronous
Kafka choreography actually works — including exactly where each producer
and consumer lives in the code, and the commands to watch a message go
in one side and come out the other.

---

## 1. Prerequisites

| Requirement | Check command | Expected |
|---|---|---|
| MySQL running, 4 databases loaded | `mysql -u <user> -p -e "SHOW DATABASES LIKE '%DB';"` | `RestaurantDB`, `OrderDB`, `DeliveryDB`, `PaymentDB` |
| Kafka broker running | `docker ps --filter name=food-delivery-kafka` | container `Up`, port `9094` mapped |
| Java 21, Maven | `java -version` / `mvn -version` | Java 21.x |

If the databases aren't loaded yet:
```bash
cd Documents/Java_Projects/Spring-boot-food-delivery-async-repository-pattern/sql
for f in 01_restaurant_db.sql 02_order_db.sql 03_delivery_db.sql 04_payment_db.sql; do
  mysql -u <user> -p < "$f"
done
```

If the Kafka container isn't running yet:
```bash
docker start food-delivery-kafka
# or, if it doesn't exist at all, see 202607020217_async_kafka_r2dbc_repository_guide.md §4
# for the full `docker run` command that creates it.
```

---

## 2. Build

```bash
cd Documents/Java_Projects/Spring-boot-food-delivery-async-repository-pattern
mvn clean package -DskipTests
```
Expect `BUILD SUCCESS` for all 4 modules. To build/verify one module at a
time (useful while iterating):
```bash
mvn -pl restaurant-service -am clean package -DskipTests
mvn -pl payment-service -am clean package -DskipTests
mvn -pl delivery-service -am clean package -DskipTests
mvn -pl order-service -am clean package -DskipTests
```

To run the test suite (if/when tests are added — this project currently
ships with `spring-boot-starter-test`/`reactor-test`/`spring-kafka-test` on
the classpath but no test classes yet):
```bash
mvn test
```

---

## 3. Start all four services

Each is an independent Spring Boot fat jar. Start them in any order — each
one is independently runnable; the Kafka choreography only actually *fires*
once you place an order via `order-service`.

```bash
cd Documents/Java_Projects/Spring-boot-food-delivery-async-repository-pattern

java -jar restaurant-service/target/restaurant-service.jar > /tmp/restaurant-service.log 2>&1 &
java -jar payment-service/target/payment-service.jar       > /tmp/payment-service.log    2>&1 &
java -jar delivery-service/target/delivery-service.jar     > /tmp/delivery-service.log   2>&1 &
java -jar order-service/target/order-service.jar           > /tmp/order-service.log      2>&1 &
```

| Service | Port | Log file |
|---|---|---|
| restaurant-service | 8095 | `/tmp/restaurant-service.log` |
| payment-service | 8096 | `/tmp/payment-service.log` |
| delivery-service | 8097 | `/tmp/delivery-service.log` |
| order-service | 8098 | `/tmp/order-service.log` |

Confirm each started cleanly:
```bash
grep -E "Started.*Application|APPLICATION FAILED" /tmp/restaurant-service.log /tmp/payment-service.log /tmp/delivery-service.log /tmp/order-service.log
```
Expect one `Started XxxServiceApplication in N.NNN seconds` line per file
and no `APPLICATION FAILED` anywhere.

Stop everything when done:
```bash
pkill -f "restaurant-service.jar|payment-service.jar|delivery-service.jar|order-service.jar"
```

Environment variables you can override (all have sane localhost defaults):
`DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `KAFKA_BOOTSTRAP_SERVERS`.

---

## 4. Where the Kafka producers and consumers actually are

| Topic | Producer (file) | Consumer(s) (file) |
|---|---|---|
| `order-events` | `order-service` → `event/OrderEventProducer.java`, called from `service/OrderService.create()` | `payment-service` → `event/OrderEventListener.java` |
| `payment-events` | `payment-service` → `event/PaymentEventProducer.java`, called from `service/PaymentService.processOrderPayment()` | `order-service` → `event/PaymentEventListener.java` (factory: `paymentEventsContainerFactory`); `delivery-service` → `event/PaymentEventListener.java` |
| `delivery-events` | `delivery-service` → `event/DeliveryEventProducer.java`, called from `service/DeliveryService.processPaymentCompleted()` | `order-service` → `event/DeliveryEventListener.java` (factory: `deliveryEventsContainerFactory`) |

Each topic is also declared as a `NewTopic` `@Bean` in each producing
service's `config/KafkaTopicConfig.java`.

**Consumer group IDs** (set via `spring.kafka.consumer.group-id` in each
service's `application.properties`): `payment-service`, `delivery-service`,
`order-service` — each service is its own consumer group, so every message
published gets delivered to every interested service independently.

---

## 5. Inspecting Kafka directly (no Spring involved)

The `food-delivery-kafka` container ships the real Kafka CLI tools at
`/opt/kafka/bin/`. These commands talk to the broker exactly like the Spring
apps do, just without any Java/Spring in the way — useful for proving the
broker itself is doing its job independent of the application code.

### 5.1 List all topics
```bash
docker exec food-delivery-kafka /opt/kafka/bin/kafka-topics.sh \
  --bootstrap-server localhost:9092 --list
```
**Actual output (captured from this session):**
```
__consumer_offsets
delivery-events
order-events
payment-events
test-connectivity
```
(`__consumer_offsets` is Kafka's own internal bookkeeping topic — ignore it.
`test-connectivity` was a throwaway topic from initial broker testing, not
used by the application.) Use `localhost:9092` here — that's the broker's
*internal* listener, reachable from inside the container; the app services
outside the container use the `EXTERNAL` listener on `9094`.

### 5.2 Describe a topic (partitions, leader, replicas)
```bash
docker exec food-delivery-kafka /opt/kafka/bin/kafka-topics.sh \
  --bootstrap-server localhost:9092 --describe --topic order-events
```
**Actual output:**
```
Topic: order-events	TopicId: DNi5GwFJQaafcli3qpoTKQ	PartitionCount: 1	ReplicationFactor: 1	Configs: min.insync.replicas=1
	Topic: order-events	Partition: 0	Leader: 1	Replicas: 1	Isr: 1	Elr: 	LastKnownElr:
```

### 5.3 List active consumer groups
```bash
docker exec food-delivery-kafka /opt/kafka/bin/kafka-consumer-groups.sh \
  --bootstrap-server localhost:9092 --list
```
**Actual output** (with all four services running):
```
delivery-service
payment-service
console-consumer-9022
test-group
order-service
manual-inspector-1782938053249
```
The three that matter are `payment-service`, `delivery-service`,
`order-service` — one per service, matching each one's
`spring.kafka.consumer.group-id`. The others (`console-consumer-9022`,
`test-group`, `manual-inspector-...`) are leftovers from manual CLI testing
during development and can be ignored (or removed with
`kafka-consumer-groups.sh --delete --group <name>` if you want a clean list).

### 5.4 Check consumer lag — the single most useful "did it actually consume?" command
```bash
docker exec food-delivery-kafka /opt/kafka/bin/kafka-consumer-groups.sh \
  --bootstrap-server localhost:9092 --describe --group payment-service --group delivery-service --group order-service
```
**Actual output (captured immediately after placing a test order):**
```
GROUP            TOPIC           PARTITION  CURRENT-OFFSET  LOG-END-OFFSET  LAG             CONSUMER-ID                                                      HOST            CLIENT-ID
delivery-service payment-events  0          3               3               0               consumer-delivery-service-1-538fd46e-d934-49b3-8ad7-cf9c77707512 /172.17.0.1     consumer-delivery-service-1

GROUP           TOPIC           PARTITION  CURRENT-OFFSET  LOG-END-OFFSET  LAG             CONSUMER-ID                                                   HOST            CLIENT-ID
order-service   payment-events  0          3               3               0               consumer-order-service-2-ad393cb4-9f10-4359-92a3-0e1cf281e222 /172.17.0.1     consumer-order-service-2
order-service   delivery-events 0          3               3               0               consumer-order-service-1-6b60a797-9faf-45ea-a727-534ccf9255aa /172.17.0.1     consumer-order-service-1

GROUP           TOPIC           PARTITION  CURRENT-OFFSET  LOG-END-OFFSET  LAG             CONSUMER-ID                                                     HOST            CLIENT-ID
payment-service order-events    0          3               3               0               consumer-payment-service-1-a56b5960-9ec1-4238-a010-39fab2eafecf /172.17.0.1     consumer-payment-service-1
```
**`LAG = 0`** on every row means each consumer has read every message ever
published to that topic — nothing is sitting unprocessed. Note that
`order-service` shows up **twice**, as two separate consumer instances
(`consumer-order-service-1` and `-2`) — this is the two custom container
factories (`paymentEventsContainerFactory`, `deliveryEventsContainerFactory`)
from `config/KafkaConsumerConfig.java` in action, each maintaining its own
connection to its own topic under the same logical consumer group. If
`CURRENT-OFFSET` is behind `LOG-END-OFFSET`, there are unconsumed messages
waiting (the consumer is either down, slow, or stuck on an error — see §7.3
for how to reproduce this on purpose).

### 5.5 Manually publish a message (bypassing order-service entirely)

Useful to test `payment-service`'s consumer in total isolation, without
needing `order-service` running at all:
```bash
echo '{"orderId":1,"customerId":1,"restaurantId":1,"finalAmount":913.00,"paymentMethodId":1,"deliveryAddressText":"221B Residency Road, Bengaluru"}' | \
  docker exec -i food-delivery-kafka /opt/kafka/bin/kafka-console-producer.sh \
  --bootstrap-server localhost:9092 --topic order-events
```
Then watch `payment-service`'s log — within about a second you should see:
```
c.f.payment.event.OrderEventListener  : Received OrderCreatedEvent for order 1
c.f.p.event.PaymentEventProducer      : Publishing PaymentCompletedEvent for order 1 (status=SUCCESS)
c.f.payment.event.OrderEventListener  : Finished processing payment for order 1
```

> **Note on manual test messages:** because the Java services configure
> `spring.json.use.type.headers=false` and always deserialize into their own
> local event class (see the architecture guide, §6, for why), a plain JSON
> string published this way — with no special Kafka headers — is
> deserialized correctly. You do **not** need to fake a `__TypeId__` header.

### 5.6 Manually consume from a topic (watch messages as they arrive)
```bash
docker exec food-delivery-kafka /opt/kafka/bin/kafka-console-consumer.sh \
  --bootstrap-server localhost:9092 --topic payment-events --from-beginning
```
Leave this running in one terminal while you place an order in another —
you'll see the raw JSON `PaymentCompletedEvent` appear the moment
`payment-service` publishes it. `Ctrl+C` to stop.

---

## 6. End-to-end test scenario: place a real order and trace it through

This is the full "prove it actually works" walkthrough.

### Step 1 — (optional) open a live consumer on every topic, one per terminal
```bash
# terminal A
docker exec food-delivery-kafka /opt/kafka/bin/kafka-console-consumer.sh --bootstrap-server localhost:9092 --topic order-events
# terminal B
docker exec food-delivery-kafka /opt/kafka/bin/kafka-console-consumer.sh --bootstrap-server localhost:9092 --topic payment-events
# terminal C
docker exec food-delivery-kafka /opt/kafka/bin/kafka-console-consumer.sh --bootstrap-server localhost:9092 --topic delivery-events
```

### Step 2 — place an order
```bash
curl -s -X POST http://localhost:8098/api/orders -H "Content-Type: application/json" -d '{
  "customerId": 1,
  "restaurantId": 1,
  "deliveryAddressId": 1,
  "totalAmount": 450.00,
  "discountAmount": 0,
  "deliveryFee": 40.00,
  "finalAmount": 490.00
}'
```
**Actual response (captured from this session, order id 6):**
```json
{"orderId":6,"customerId":1,"restaurantId":1,"deliveryAddressId":1,"orderStatus":"PLACED","totalAmount":450.00,"discountAmount":0.00,"deliveryFee":40.00,"finalAmount":490.00,"placedAt":"2026-07-02T02:30:07","updatedAt":"2026-07-02T02:30:07"}
```
`201 Created`, `orderStatus: "PLACED"`, and a new `orderId` — note it, used
below as `<ORDER_ID>` (`6` in this captured run).

If you have terminals A/B/C open from Step 1, you'll see the raw JSON for
`OrderCreatedEvent` appear in terminal A within milliseconds, then
`PaymentCompletedEvent` in terminal B about a second later, then
`DeliveryStatusUpdatedEvent` in terminal C shortly after that.

### Step 3 — watch the order's status change on its own
```bash
sleep 3
curl -s "http://localhost:8098/api/order-status-history?orderId=<ORDER_ID>" | python3 -m json.tool
```
**Actual response:** three entries, written by three different services,
with nobody having called any of them directly:
```json
[
  {
    "historyId": 17, "orderId": 6, "status": "PLACED",
    "notes": "Order placed by customer", "changedAt": "2026-07-02T02:30:07"
  },
  {
    "historyId": 18, "orderId": 6, "status": "CONFIRMED",
    "notes": "Payment successful (ref TXN-0C83E3B7)", "changedAt": "2026-07-02T02:30:08"
  },
  {
    "historyId": 19, "orderId": 6, "status": "ASSIGNED",
    "notes": "Assigned to Ravi Kumar", "changedAt": "2026-07-02T02:30:09"
  }
]
```
Note the timestamps: `PLACED` at `:07`, `CONFIRMED` at `:08`, `ASSIGNED` at
`:09` — one second apart, each written by a different JVM, none of them
called directly.
```bash
curl -s "http://localhost:8098/api/orders/<ORDER_ID>"
```
**Actual response:**
```json
{"orderId":6,"customerId":1,"restaurantId":1,"deliveryAddressId":1,"orderStatus":"ASSIGNED","totalAmount":450.00,"discountAmount":0.00,"deliveryFee":40.00,"finalAmount":490.00,"placedAt":"2026-07-02T02:30:07","updatedAt":"2026-07-02T02:30:09"}
```

### Step 4 — confirm the actual data each service wrote
```bash
curl -s "http://localhost:8096/api/payments?orderId=<ORDER_ID>"
```
**Actual response:**
```json
[{"paymentId":7,"orderId":6,"amount":490.00,"currency":"INR","status":"SUCCESS","transactionRef":"TXN-0C83E3B7","paidAt":"2026-07-02T02:30:08","createdAt":"2026-07-02T02:30:08"}]
```
```bash
curl -s "http://localhost:8097/api/deliveries?orderId=<ORDER_ID>"
```
**Actual response:**
```json
[{"deliveryId":7,"orderId":6,"partnerId":1,"pickupAddress":"Restaurant #1","dropAddress":"221B Residency Road, Bengaluru, Karnataka, 560025","status":"ASSIGNED","estimatedDeliveryTime":"2026-07-02T03:15:09","createdAt":"2026-07-02T02:30:09","updatedAt":"2026-07-02T02:30:09"}]
```
Note `dropAddress` — that's the real customer address, built by
`order-service` from its own `Customer_Address` row and carried through two
Kafka hops (`OrderCreatedEvent` → `PaymentCompletedEvent`) untouched by
either `payment-service` or `delivery-service`.
```bash
curl -s "http://localhost:8097/api/delivery-statuses?deliveryId=<DELIVERY_ID>"
```
**Actual response:**
```json
[{"statusId":11,"deliveryId":7,"status":"ASSIGNED","notes":"Assigned to Ravi Kumar","changedAt":"2026-07-02T02:30:09"}]
```

### Step 5 — confirm via consumer-group lag that nothing is stuck
```bash
docker exec food-delivery-kafka /opt/kafka/bin/kafka-consumer-groups.sh \
  --bootstrap-server localhost:9092 --describe --group payment-service --group delivery-service --group order-service
```
**Actual output** (see §5.4 above for the full captured table) — `LAG`
column reads `0` for every topic/partition each group is subscribed to:
every published message had been consumed by the time this ran.

### Step 6 — cross-check directly against MySQL (bypassing the REST layer entirely)
```bash
mysql -u abhig -h localhost -e "SELECT * FROM OrderDB.Orders WHERE order_id=6;" --table
```
**Actual output:**
```
+----------+-------------+---------------+---------------------+-----------+--------------+--------------+-----------------+--------------+--------------+---------------------+---------------------+
| order_id | customer_id | restaurant_id | delivery_address_id | coupon_id | order_status | total_amount | discount_amount | delivery_fee | final_amount | placed_at           | updated_at          |
+----------+-------------+---------------+---------------------+-----------+--------------+--------------+-----------------+--------------+--------------+---------------------+---------------------+
|        6 |           1 |             1 |                    1 |      NULL | ASSIGNED     |       450.00 |            0.00 |        40.00 |       490.00 | 2026-07-02 02:30:07 | 2026-07-02 02:30:09 |
+----------+-------------+---------------+---------------------+-----------+--------------+--------------+-----------------+--------------+--------------+---------------------+---------------------+
```
```bash
mysql -u abhig -h localhost -e "SELECT * FROM PaymentDB.Payments WHERE order_id=6;" --table
```
**Actual output:**
```
+------------+----------+-----------+--------+----------+---------+-----------------+---------------------+---------------------+
| payment_id | order_id | method_id | amount | currency | status  | transaction_ref | paid_at             | created_at          |
+------------+----------+-----------+--------+----------+---------+-----------------+---------------------+---------------------+
|          7 |        6 |      NULL | 490.00 | INR      | SUCCESS | TXN-0C83E3B7    | 2026-07-02 02:30:08 | 2026-07-02 02:30:08 |
+------------+----------+-----------+--------+----------+---------+-----------------+---------------------+---------------------+
```
```bash
mysql -u abhig -h localhost -e "SELECT * FROM DeliveryDB.Deliveries WHERE order_id=6;" --table
```
**Actual output:**
```
+-------------+----------+------------+----------------+---------------------------------------------------+----------+-------------------------+----------------------+---------------------+---------------------+
| delivery_id | order_id | partner_id | pickup_address | drop_address                                       | status   | estimated_delivery_time | actual_delivery_time | created_at          | updated_at          |
+-------------+----------+------------+----------------+---------------------------------------------------+----------+-------------------------+----------------------+---------------------+---------------------+
|           7 |        6 |          1 | Restaurant #1  | 221B Residency Road, Bengaluru, Karnataka, 560025  | ASSIGNED | 2026-07-02 03:15:09     | NULL                  | 2026-07-02 02:30:09 | 2026-07-02 02:30:09 |
+-------------+----------+------------+----------------+---------------------------------------------------+----------+-------------------------+----------------------+---------------------+---------------------+
```
This confirms the data really is in the database, not just something the
REST layer is fabricating in a response.

### Step 7 — clean up the test order (if you don't want it to linger)
```bash
curl -s -o /dev/null -w "%{http_code}\n" -X DELETE http://localhost:8097/api/delivery-statuses/11
curl -s -o /dev/null -w "%{http_code}\n" -X DELETE http://localhost:8097/api/deliveries/7
curl -s -o /dev/null -w "%{http_code}\n" -X DELETE http://localhost:8096/api/payments/7
for h in 17 18 19; do curl -s -o /dev/null -w "%{http_code}\n" -X DELETE http://localhost:8098/api/order-status-history/$h; done
curl -s -o /dev/null -w "%{http_code}\n" -X DELETE http://localhost:8098/api/orders/6
```
**Actual output:** `204` printed six times (once per delete) — every
resource removed with no error.

Also restore the delivery partner's availability if the test assigned one:
```bash
curl -s -X PUT http://localhost:8097/api/delivery-partners/1 \
  -H "Content-Type: application/json" \
  -d '{"name":"Ravi Kumar","phone":"9900000001","email":"ravi.kumar@delivery.example","vehicleType":"Motorcycle","licenseNumber":"DL-001","isAvailable":true,"averageRating":4.7}'
```
**Actual response:** `"isAvailable":true` confirmed in the returned JSON.

Final sanity check — row counts back to the original seed-data baseline:
```bash
mysql -u abhig -h localhost -e "
SELECT COUNT(*) FROM OrderDB.Orders;
SELECT COUNT(*) FROM PaymentDB.Payments;
SELECT COUNT(*) FROM DeliveryDB.Deliveries;
"
```
**Actual output:**
```
COUNT(*)
3
COUNT(*)
3
COUNT(*)
3
```
All three back to `3` — exactly the original seeded row count in each
table, confirming the test order left no residue behind.

---

## 7. Testing failure/edge scenarios

### 7.1 What happens if a delivery partner isn't available?
`DeliveryService.processPaymentCompleted()` falls back to creating an
**unassigned** delivery (`status: PENDING`, `partnerId: null`) instead of
failing. To see this path, mark every partner unavailable first:
```bash
curl -s http://localhost:8097/api/delivery-partners | python3 -c "
import json,sys
for p in json.load(sys.stdin):
    print(p['partnerId'])
" | while read id; do
  curl -s -X PUT http://localhost:8097/api/delivery-partners/$id \
    -H "Content-Type: application/json" \
    -d '{"name":"x","phone":"x","isAvailable":false}' > /dev/null
done
```
Then place an order and check:
```bash
curl -s "http://localhost:8097/api/deliveries?orderId=<ORDER_ID>"
# -> "status":"PENDING", "partnerId": null
```
Remember to restore the partners' original `isAvailable` values afterward.

### 7.2 SQL-injection-style input is rejected before it reaches the database
```bash
curl -s -w "\nHTTP:%{http_code}\n" "http://localhost:8098/api/orders/1' OR '1'='1"
```
**Actual output (captured from this session):**
```
{"timestamp":"2026-07-02T02:16:57.846884342","status":400,"error":"Bad Request","message":"Invalid request input: Type mismatch."}
HTTP:400
```
This proves the malformed value never reached a repository or a SQL
statement — Spring WebFlux's own parameter binding rejected it first.

### 7.3 What if a consumer is down when a message is published?
Stop `delivery-service`, publish an order, confirm `payment-events` shows
lag for the `delivery-service` group, then start `delivery-service` back up
and watch the lag disappear as it catches up:
```bash
pkill -f delivery-service.jar
# ...place an order via order-service...
docker exec food-delivery-kafka /opt/kafka/bin/kafka-consumer-groups.sh \
  --bootstrap-server localhost:9092 --describe --group delivery-service
# -> LAG > 0

java -jar delivery-service/target/delivery-service.jar &
sleep 5
docker exec food-delivery-kafka /opt/kafka/bin/kafka-consumer-groups.sh \
  --bootstrap-server localhost:9092 --describe --group delivery-service
# -> LAG back to 0, and the delivery was created/assigned after the fact
```
This is the clearest possible demonstration that Kafka — not a direct
call — is what connects these services: the message waited durably in the
topic until a consumer was available to process it.

---

## 8. Quick reference — all commands in one place

```bash
# Build
mvn clean package -DskipTests

# Start
java -jar restaurant-service/target/restaurant-service.jar &
java -jar payment-service/target/payment-service.jar &
java -jar delivery-service/target/delivery-service.jar &
java -jar order-service/target/order-service.jar &

# Stop
pkill -f "restaurant-service.jar|payment-service.jar|delivery-service.jar|order-service.jar"

# Kafka topic/consumer inspection
docker exec food-delivery-kafka /opt/kafka/bin/kafka-topics.sh --bootstrap-server localhost:9092 --list
docker exec food-delivery-kafka /opt/kafka/bin/kafka-consumer-groups.sh --bootstrap-server localhost:9092 --list
docker exec food-delivery-kafka /opt/kafka/bin/kafka-consumer-groups.sh --bootstrap-server localhost:9092 --describe --group payment-service

# Manual produce / consume (bypassing the Java services)
docker exec -i food-delivery-kafka /opt/kafka/bin/kafka-console-producer.sh --bootstrap-server localhost:9092 --topic order-events
docker exec food-delivery-kafka /opt/kafka/bin/kafka-console-consumer.sh --bootstrap-server localhost:9092 --topic payment-events --from-beginning

# Place an order and trace it
curl -X POST http://localhost:8098/api/orders -d '{"customerId":1,"restaurantId":1,"deliveryAddressId":1,"totalAmount":450.00,"deliveryFee":40.00,"finalAmount":490.00}'
curl "http://localhost:8098/api/order-status-history?orderId=<ID>"
curl "http://localhost:8096/api/payments?orderId=<ID>"
curl "http://localhost:8097/api/deliveries?orderId=<ID>"
```
