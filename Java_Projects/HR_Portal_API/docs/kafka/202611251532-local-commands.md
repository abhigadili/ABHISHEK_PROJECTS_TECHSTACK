# Local Kafka commands

Kafka runs in Docker (`hr-kafka`, KRaft, no Zookeeper). Host listener `localhost:9192`; inside the container `kafka:29092`. Kafka UI: <http://localhost:9190>.

```bash
docker compose up -d kafka kafka-init kafka-ui        # start broker, create topics, UI
docker exec hr-kafka /opt/kafka/bin/kafka-topics.sh --bootstrap-server kafka:29092 --list
docker exec hr-kafka /opt/kafka/bin/kafka-topics.sh --bootstrap-server kafka:29092 --describe --topic leave.approved
docker exec hr-kafka /opt/kafka/bin/kafka-consumer-groups.sh --bootstrap-server kafka:29092 --list
docker exec hr-kafka /opt/kafka/bin/kafka-consumer-groups.sh --bootstrap-server kafka:29092 --describe --group hr-reporting-service   # lag
```

## View messages
```bash
# latest / all messages of a topic
docker exec hr-kafka /opt/kafka/bin/kafka-console-consumer.sh --bootstrap-server kafka:29092 \
   --topic employee.created --from-beginning --timeout-ms 5000
# show key, partition, offset
docker exec hr-kafka /opt/kafka/bin/kafka-console-consumer.sh --bootstrap-server kafka:29092 --topic leave.approved \
   --from-beginning --property print.key=true --property print.partition=true --property print.offset=true --timeout-ms 5000
# dead letters
docker exec hr-kafka /opt/kafka/bin/kafka-console-consumer.sh --bootstrap-server kafka:29092 --topic leave.approved.DLT --from-beginning --timeout-ms 5000
# notification retry / dead-letter topics created by @RetryableTopic
docker exec hr-kafka /opt/kafka/bin/kafka-topics.sh --bootstrap-server kafka:29092 --list | grep notification.requested
```

## Produce a test message by hand
```bash
echo 'k1:{"metadata":{"eventId":"11111111-1111-1111-1111-111111111111","eventType":"holiday.changed","version":1,"timestamp":"2026-11-25T00:00:00Z","correlationId":"manual","sourceService":"manual"},"holidayId":"h1","name":"Test","date":"2026-12-25","action":"CREATED"}' | \
docker exec -i hr-kafka /opt/kafka/bin/kafka-console-producer.sh --bootstrap-server kafka:29092 --topic holiday.changed \
   --property parse.key=true --property key.separator=:
```

## Reset a consumer group (replay)
```bash
# stop the service first (a running consumer blocks the reset)
docker exec hr-kafka /opt/kafka/bin/kafka-consumer-groups.sh --bootstrap-server kafka:29092 --group hr-reporting-service \
   --reset-offsets --to-earliest --all-topics --execute
```
Replays are safe: every consumer is idempotent (event-id ledger) and the reporting upserts are rank-protected.

## From the API
`GET /api/v1/notifications/kafka/topics` (HR_ADMIN / SUPER_ADMIN) lists topics with partitions, and event history is at `GET /api/v1/notifications/events/history`.
