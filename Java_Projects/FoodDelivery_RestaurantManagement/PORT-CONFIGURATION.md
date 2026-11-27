# Port configuration

All ports are above the Linux ephemeral range start only where noted; everything below is a **fixed** port, chosen not to clash with other local projects (MySQL 3306, mongo 27017-27019, rcx stack 3000/5858/5959).

| Component | Port | Notes |
|---|---|---|
| Angular dev server | **4500** | `npm start` in `frontend/`, proxies `/api`, `/docs`, `/swagger-ui` to the gateway |
| API Gateway | **9080** | the only entry point for the frontend; Swagger UI at `/swagger-ui.html` |
| Service discovery (Eureka) | **9761** | dashboard `http://localhost:9761` |
| user-service | 9101 | DB `food_user_db` |
| customer-service | 9102 | DB `food_customer_db` |
| restaurant-service | 9103 | DB `food_restaurant_db` |
| menu-service | 9104 | DB `food_menu_db` |
| cart-service | 9105 | DB `food_cart_db` |
| order-service | 9106 | DB `food_order_db` |
| payment-service | 9107 | DB `food_payment_db` |
| delivery-service | 9108 | DB `food_delivery_db` |
| notification-service | 9109 | DB `food_notification_db` |
| review-service | 9110 | DB `food_review_db` |
| coupon-service | 9111 | DB `food_coupon_db` |
| inventory-service | 9112 | DB `food_inventory_db` |
| search-service | 9113 | DB `food_search_db` |
| admin-service | 9114 | DB `food_admin_db` |
| event-audit-service | 9115 | DB `food_event_audit_db` (also Kafka monitoring, log search, health overview) |
| MySQL (existing host server) | 3306 | credentials in the git-ignored `.env` |
| Kafka (KRaft, container `food-kafka`) | **9392** | host listener (container port 9092) |
| Redis (container `food-redis`) | **6390** | container port 6379 |
| Elasticsearch (container `food-elasticsearch`) | **9400** | container port 9200 |
| Kibana (container `food-kibana`) | **5601** | dashboard "Food Delivery - Operations" |
| Logstash (container `food-logstash`) | – | reads `logs/*.json.log`, no published port |

Change a port in the service's `application.yml` (`server.port`), in `scripts/common.sh` (service table), and in `api-gateway` only if the gateway route table changes (it routes by Eureka service name, not by port).
