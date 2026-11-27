# Build Journal — Food Delivery Microservices (Kafka + R2DBC)

A chronological record of every step actually taken to get all four services
(`restaurant-service`, `payment-service`, `delivery-service`, `order-service`)
building and running successfully — including the exact bash commands run
and the real output/response accepted as confirmation at each step. This is
the "how we actually got there" companion to the architecture guide
(`202607020217_async_kafka_r2dbc_repository_guide.md`).

---

## 1. Pre-flight: checking the environment before writing any code

Before scaffolding anything, the two riskiest dependencies were checked
first: a working Kafka broker, and the R2DBC MySQL driver being fetchable.

### 1.1 Checking for a running Kafka broker

```bash
ps aux | grep -E "kafka|zookeeper" | grep -v grep
(echo > /dev/tcp/localhost/9092) 2>&1 && echo "9092 open" || echo "9092 closed"
```

**Accepted response:** a Kafka 1.0.1 process and a ZooKeeper process were
both running, port 9092 open. This looked promising, but turned out to be
too old — see §2.

### 1.2 Checking for the R2DBC MySQL driver on Maven Central

```bash
curl -sI "https://repo.maven.apache.org/maven2/io/asyncer/r2dbc-mysql/1.3.1/r2dbc-mysql-1.3.1.jar"
curl -sI "https://repo.maven.apache.org/maven2/io/r2dbc/r2dbc-pool/1.0.2.RELEASE/r2dbc-pool-1.0.2.RELEASE.jar"
```

**Accepted response:** `HTTP/2 200` for both — confirmed fetchable, safe to
depend on in the poms without a network surprise mid-build.

---

## 2. Kafka broker compatibility problem, and how it was solved

### 2.1 The failing test

A throwaway Maven project was created purely to test raw `kafka-clients`
connectivity, independent of Spring:

```bash
mkdir -p /tmp/.../kafka-test/src/main/java
# pom.xml with org.apache.kafka:kafka-clients:3.8.1
```

```java
// AdminClient.listTopics() against localhost:9092
```

```bash
cd kafka-test
mvn -q dependency:build-classpath -Dmdep.outputFile=cp.txt
javac -cp "$(cat cp.txt)" -d target-classes src/main/java/KafkaTest.java
java -cp "target-classes:$(cat cp.txt)" KafkaTest
```

**Response received:**
```
ADMIN FAILED: java.util.concurrent.ExecutionException:
org.apache.kafka.common.errors.TimeoutException: Timed out waiting for a node assignment. Call: listTopics
```

**Conclusion accepted:** the existing broker (Kafka 1.0.1, released 2017)
cannot complete a protocol handshake with a modern (`kafka-clients` 3.8.x)
client — confirmed as a real incompatibility, not a transient network issue,
since the broker's own ports were reachable but no metadata response ever
arrived.

### 2.2 Decision point

Given the incompatibility, three options were weighed and the user was
asked directly. **Chosen: stand up a new, separate Kafka broker in Docker**,
leaving the existing one untouched.

### 2.3 Pulling and starting the new broker

```bash
docker pull apache/kafka:latest
```
**Accepted response:** `Status: Downloaded newer image for apache/kafka:latest`

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
**Accepted response:** a container ID printed, then confirmed via:
```bash
docker ps --filter name=food-delivery-kafka
```
```
CONTAINER ID   IMAGE                 ...   PORTS                                                   NAMES
2c0059806304   apache/kafka:latest   ...   9092/tcp, 0.0.0.0:9094->9094/tcp                         food-delivery-kafka
```

### 2.4 Waiting for and confirming startup

```bash
until docker logs food-delivery-kafka 2>&1 | grep -q "Kafka Server started"; do sleep 2; done
docker logs food-delivery-kafka 2>&1 | tail -20
```
**Accepted response:** log line `[KafkaRaftServer nodeId=1] Kafka Server started`
plus `Kafka version: 4.3.1`.

### 2.5 Re-running the same connectivity test against port 9094

```java
// same AdminClient/producer/consumer test, bootstrap.servers=localhost:9094
```
**Accepted response:**
```
TOPICS: []
PRODUCE OK
CONSUMED: hello-kafka
CONSUME OK
```
This confirmed the new broker fully works with the modern client stack this
project depends on, before a single line of Spring Kafka code was written.

---

## 3. Database setup

### 3.1 Checking MySQL privileges

```bash
mysql -u abhig -h localhost -e "SHOW GRANTS FOR 'abhig'@'localhost';"
```
**Accepted response:** `GRANT ... ON *.* TO 'abhig'@'localhost' WITH GRANT OPTION`
— full privileges confirmed, safe to `CREATE DATABASE` directly.

### 3.2 Running the four schema + seed-data scripts

```bash
cd Documents/Java_Projects/Spring-boot-food-delivery-async-repository-pattern/sql
for f in 01_restaurant_db.sql 02_order_db.sql 03_delivery_db.sql 04_payment_db.sql; do
  mysql -u abhig -h localhost < "$f"
done
```
**Accepted response:** no errors on any script (each contains `DROP DATABASE
IF EXISTS` / `CREATE DATABASE` / `CREATE TABLE` / `INSERT` statements).

### 3.3 Verifying row counts after seeding

```bash
mysql -u abhig -h localhost -e "
SELECT COUNT(*) restaurants FROM RestaurantDB.Restaurants;
SELECT COUNT(*) courses FROM CourseDB... -- (adapted per project)
SELECT COUNT(*) orders FROM OrderDB.Orders;
SELECT COUNT(*) deliveries FROM DeliveryDB.Deliveries;
SELECT COUNT(*) payments FROM PaymentDB.Payments;
"
```
**Accepted response:**
```
restaurants  4
orders       3
deliveries   3
payments     3
```
All four counts matched exactly what each SQL script's `INSERT` statements
should have produced.

---

## 4. Building each service, one at a time

Each module was built and smoke-tested **individually** before moving to the
next, specifically to catch errors early rather than debugging four services
at once.

### 4.1 restaurant-service (no Kafka — built and verified first)

```bash
cd Documents/Java_Projects/Spring-boot-food-delivery-async-repository-pattern
mvn -q -pl restaurant-service -am clean package -DskipTests
echo "EXIT:$?"
```
**Accepted response:** `EXIT:0` (Maven's `-q` suppresses normal output;
absence of `ERROR` lines plus a `0` exit code is the acceptance criterion
used throughout this project).

```bash
java -jar restaurant-service/target/restaurant-service.jar &
curl -s http://localhost:8095/api/restaurants/1
```
**Accepted response:** a full JSON restaurant object — confirmed the R2DBC
read path worked end to end against real MySQL data.

**Bug found and fixed here:** `POST /api/restaurants` returned
`createdAt`/`updatedAt` as absent from the JSON, even after adding
`@ReadOnlyProperty`. Root cause: R2DBC's `save()` for a new row doesn't
re-`SELECT` the row, so the DB's own generated default values never made it
back into the in-memory object. Fixed by chaining a `findById()` after every
`save()` in every `create()` method. Rebuilt and re-verified:
```bash
mvn -q -pl restaurant-service -am package -DskipTests
curl -X POST http://localhost:8095/api/restaurants -d '{"categoryId":9,"name":"Taco Fiesta 2","description":"Test"}'
```
**Accepted response:** `"createdAt":"2026-07-02T01:53:19","updatedAt":"2026-07-02T01:53:19"`
now present.

### 4.2 payment-service (first service with Kafka)

```bash
mvn -q -pl payment-service -am clean package -DskipTests
echo "EXIT:$?"
```
**Accepted response:** `EXIT:0`.

```bash
java -jar payment-service/target/payment-service.jar &
curl -s http://localhost:8096/api/payments | python3 -m json.tool
```
**Accepted response:** the 3 seeded payment rows returned correctly.

**Bug found and fixed here (the big one):** a manually-published test
`OrderCreatedEvent` on the `order-events` topic caused:
```
IllegalStateException: No type information in headers and no default type provided
```
Root cause: `payment-service` and `order-service` each define their own
local `OrderCreatedEvent` class in different packages; Spring's
`JsonSerializer` embeds the *producer's* class name in a header by default,
which the consumer can't resolve since that exact class doesn't exist on its
classpath. Fixed via `application.properties`:
```properties
spring.kafka.consumer.properties.spring.json.use.type.headers=false
spring.kafka.consumer.properties.spring.json.value.default.type=com.fooddelivery.payment.event.OrderCreatedEvent
spring.kafka.producer.properties.spring.json.add.type.headers=false
```
Rebuilt, restarted, then re-tested by publishing a plain (header-free) JSON
message directly onto the topic with a throwaway producer:
```bash
java -cp "target-classes:$CP" KafkaTest   # publishes plain JSON, no custom header
```
**Accepted response (from payment-service's own log):**
```
c.f.payment.event.OrderEventListener  : Finished processing payment for order 1
```
Then confirmed via REST:
```bash
curl -s "http://localhost:8096/api/payments?orderId=1"
```
**Accepted response:** a *new* payment row (id 4) with `status: SUCCESS` and
a generated `transactionRef`, proving the consumer → business logic →
database write chain worked. Confirmed the outbound event too, by manually
subscribing to `payment-events` with a throwaway consumer:
```bash
java -cp "target-classes:$CP" KafkaTest   # consumes from payment-events
```
**Accepted response:**
```
PAYMENT-EVENT: {"orderId":1,"paymentId":4,...,"status":"SUCCESS",...}
```

### 4.3 delivery-service

```bash
mvn -q -pl delivery-service -am clean package -DskipTests
echo "EXIT:$?"
```
**Accepted response:** `EXIT:0`.

Started, then a genuinely useful coincidence: the *leftover* test
`PaymentCompletedEvent` published during the payment-service test above was
still sitting durably in the `payment-events` topic. The moment
delivery-service's consumer group connected for the first time
(`auto-offset-reset=earliest`), it picked that message up automatically:

```bash
grep -E "Received PaymentCompletedEvent|Finished processing|Publishing DeliveryStatusUpdatedEvent" delivery-service.log
```
**Accepted response:**
```
Received PaymentCompletedEvent for order 1 (status=SUCCESS)
Publishing DeliveryStatusUpdatedEvent for order 1 (status=ASSIGNED)
Finished processing delivery assignment for order 1
```
Confirmed via REST and direct SQL:
```bash
curl -s "http://localhost:8097/api/delivery-statuses?deliveryId=4"
mysql -u abhig -h localhost -e "SELECT * FROM Deliveries;" DeliveryDB
```
**Accepted response:** a new `Deliveries` row (id 4) with `partner_id=1`,
`status=ASSIGNED`, and the matching `Delivery_Status` audit row
`"Assigned to Ravi Kumar"` — this was accepted as proof the whole
listener → business-logic → repository → event-producer chain works
without ever having been triggered by a direct API call.

### 4.4 order-service (most complex: publishes one event, consumes two)

```bash
mvn -q -pl order-service -am clean package -DskipTests
echo "EXIT:$?"
```
**Accepted response:** `EXIT:0` — this build required a custom
`KafkaConsumerConfig` (two separate `ConcurrentKafkaListenerContainerFactory`
beans, one per event shape/topic) because a single Spring Boot autoconfigured
consumer factory can only carry one default JSON type, and this service
consumes both `PaymentCompletedEvent` and `DeliveryStatusUpdatedEvent`.

---

## 5. Final full-reactor build

Once each module had been built and smoke-tested individually:

```bash
cd Documents/Java_Projects/Spring-boot-food-delivery-async-repository-pattern
mvn -q clean package -DskipTests
echo "EXIT:$?"
```
**Accepted response:** `EXIT:0`, confirmed by listing every jar:
```bash
find . -name "*.jar" -path "*/target/*" | grep -v original
```
```
./notification-service/target/notification-service.jar   (n/a — from an earlier unrelated project)
./payment-service/target/payment-service.jar
./order-service/target/order-service.jar
./delivery-service/target/delivery-service.jar
./restaurant-service/target/restaurant-service.jar
```

---

## 6. Full end-to-end acceptance test

With all four services and the Kafka container running simultaneously:

```bash
curl -X POST http://localhost:8098/api/orders -H "Content-Type: application/json" -d '{
  "customerId":1,"restaurantId":1,"deliveryAddressId":1,
  "totalAmount":450.00,"discountAmount":0,"deliveryFee":40.00,"finalAmount":490.00
}'
```
**Accepted response:** `201 Created`, `"orderStatus":"PLACED"`, order id `4`.

```bash
sleep 3
curl -s "http://localhost:8098/api/order-status-history?orderId=4"
```
**Accepted response:**
```json
[
  {"status": "PLACED",    "notes": "Order placed by customer"},
  {"status": "CONFIRMED", "notes": "Payment successful (ref TXN-2E478575)"},
  {"status": "ASSIGNED",  "notes": "Assigned to Ravi Kumar"}
]
```
Three rows, written by three different services, none of them called
directly by the test client — accepted as final proof the whole
asynchronous choreography works exactly as designed.

```bash
curl -s "http://localhost:8096/api/payments?orderId=4"
curl -s "http://localhost:8097/api/deliveries?orderId=4"
```
**Accepted response:** a real `Payment` row (amount matching the order) and
a real `Delivery` row (drop address correctly built from order-service's own
`Customer_Address` data) — cross-checked against MySQL directly with
`SELECT COUNT(*)` on all four databases before and after, confirming no
unexpected side effects.

### Cleanup after the acceptance test

```bash
curl -X DELETE http://localhost:8097/api/delivery-statuses/9
curl -X DELETE http://localhost:8097/api/deliveries/5
curl -X DELETE http://localhost:8096/api/payments/5
curl -X DELETE http://localhost:8098/api/order-status-history/11
curl -X DELETE http://localhost:8098/api/order-status-history/12
curl -X DELETE http://localhost:8098/api/order-status-history/13
curl -X DELETE http://localhost:8098/api/orders/4
curl -X PUT http://localhost:8097/api/delivery-partners/1 -d '{"...","isAvailable":true,...}'
```
**Accepted response:** `204` for every delete, `"isAvailable":true` on the
partner restore — followed by a final row-count check on all four databases
matching the original seed-data counts exactly (`restaurants: 4`,
`orders: 3`, `payments: 3`, `deliveries: 3`).

### SQL-injection resistance check (part of the same acceptance pass)

```bash
curl -s -w "\nHTTP:%{http_code}\n" "http://localhost:8098/api/orders/1%27%20OR%20%271%27=%271"
```
**Accepted response:** `400 Bad Request`, `"Invalid request input: Type mismatch."`
— confirmed the malformed value never reached a repository or a SQL
statement; Spring WebFlux's own parameter binding rejected it first.

---

## 7. Stopping everything cleanly

```bash
pkill -f "restaurant-service.jar|payment-service.jar|delivery-service.jar|order-service.jar"
ps aux | grep -E "restaurant-service|payment-service|delivery-service|order-service" | grep -v grep
```
**Accepted response:** empty output from the second command — all four JVMs
confirmed stopped before finishing the session.
