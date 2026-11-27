#!/usr/bin/env bash
# Creates the 14-day retention (ILM) policy and the index template for food-logs-* (idempotent).
ES="${ELASTICSEARCH_URL:-http://localhost:9400}"
curl -s -X PUT "$ES/_ilm/policy/food-logs-policy" -H 'Content-Type: application/json' -d '{
  "policy": {"phases": {
    "hot":    {"actions": {"set_priority": {"priority": 100}}},
    "delete": {"min_age": "14d", "actions": {"delete": {}}}}}}' ; echo
curl -s -X PUT "$ES/_index_template/food-logs-template" -H 'Content-Type: application/json' -d '{
  "index_patterns": ["food-logs-*"],
  "template": {
    "settings": {"number_of_shards": 1, "number_of_replicas": 0, "index.lifecycle.name": "food-logs-policy"},
    "mappings": {"properties": {
      "@timestamp": {"type": "date"},
      "service": {"type": "keyword"}, "environment": {"type": "keyword"}, "level": {"type": "keyword"},
      "logger": {"type": "keyword"}, "thread": {"type": "keyword"}, "category": {"type": "keyword"},
      "correlationId": {"type": "keyword"}, "traceId": {"type": "keyword"}, "spanId": {"type": "keyword"},
      "userId": {"type": "keyword"}, "eventId": {"type": "keyword"},
      "httpMethod": {"type": "keyword"}, "httpPath": {"type": "keyword"}, "httpStatus": {"type": "integer"},
      "durationMs": {"type": "integer"},
      "message": {"type": "text"},
      "error": {"properties": {"class": {"type": "keyword"}, "message": {"type": "text"}, "stack": {"type": "text"}}}}}}}' ; echo
