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
