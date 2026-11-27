#!/usr/bin/env python3
"""Generates kibana-objects.ndjson: data view, saved searches, visualizations and the 'Food Delivery - Operations' dashboard.
Import with setup-kibana.sh (POST /api/saved_objects/_import). Uses classic aggregation-based visualizations (stable import format)."""
import json

IDX = "food-logs"
REF_INDEX = [{"name": "kibanaSavedObjectMeta.searchSourceJSON.index", "type": "index-pattern", "id": IDX}]
objs = []


def search_source(query=""):
    return json.dumps({"query": {"query": query, "language": "kuery"}, "filter": [],
                       "indexRefName": "kibanaSavedObjectMeta.searchSourceJSON.index"})


def vis(vid, title, vtype, aggs, params, query="", description=""):
    objs.append({"id": vid, "type": "visualization", "attributes": {
        "title": title, "description": description,
        "visState": json.dumps({"title": title, "type": vtype, "aggs": aggs, "params": params}),
        "uiStateJSON": "{}", "kibanaSavedObjectMeta": {"searchSourceJSON": search_source(query)}},
        "references": REF_INDEX, "migrationVersion": {"visualization": "8.5.0"}, "coreMigrationVersion": "8.5.0"})


def count_agg(): return {"id": "1", "enabled": True, "type": "count", "params": {}, "schema": "metric"}


def terms_agg(i, field, schema, size=10):
    return {"id": str(i), "enabled": True, "type": "terms", "schema": schema,
            "params": {"field": field, "orderBy": "1", "order": "desc", "size": size, "otherBucket": False, "missingBucket": False}}


def date_agg(i):
    return {"id": str(i), "enabled": True, "type": "date_histogram", "schema": "segment",
            "params": {"field": "@timestamp", "useNormalizedEsInterval": True, "scaleMetricValues": False, "interval": "auto",
                       "drop_partials": False, "min_doc_count": 1, "extended_bounds": {}}}


METRIC = {"addTooltip": True, "addLegend": False, "type": "metric", "metric": {
    "percentageMode": False, "useRanges": False, "colorSchema": "Green to Red", "metricColorMode": "None",
    "colorsRange": [{"from": 0, "to": 100000}], "labels": {"show": True}, "invertColors": False,
    "style": {"bgFill": "#000", "bgColor": False, "labelColor": False, "subText": "", "fontSize": 48}}}
PIE = {"type": "pie", "addTooltip": True, "addLegend": True, "legendPosition": "right", "isDonut": True,
       "labels": {"show": True, "values": True, "last_level": True, "truncate": 100}}
HIST = {"type": "histogram", "grid": {"categoryLines": False},
        "categoryAxes": [{"id": "CategoryAxis-1", "type": "category", "position": "bottom", "show": True, "style": {}, "scale": {"type": "linear"},
                          "labels": {"show": True, "filter": True, "truncate": 100}, "title": {}}],
        "valueAxes": [{"id": "ValueAxis-1", "name": "LeftAxis-1", "type": "value", "position": "left", "show": True, "style": {},
                       "scale": {"type": "linear", "mode": "normal"}, "labels": {"show": True, "rotate": 0, "filter": False, "truncate": 100},
                       "title": {"text": "Count"}}],
        "seriesParams": [{"show": True, "type": "histogram", "mode": "stacked", "data": {"label": "Count", "id": "1"}, "valueAxis": "ValueAxis-1",
                          "drawLinesBetweenPoints": True, "lineWidth": 2, "showCircles": True}],
        "addTooltip": True, "addLegend": True, "legendPosition": "right", "times": [], "addTimeMarker": False,
        "labels": {"show": False}, "thresholdLine": {"show": False, "value": 10, "width": 1, "style": "full", "color": "#E7664C"}}
TABLE = {"perPage": 10, "showPartialRows": False, "showMetricsAtAllLevels": False, "showTotal": False, "totalFunc": "sum", "percentageCol": ""}

# data view
objs.append({"id": IDX, "type": "index-pattern", "attributes": {"title": "food-logs-*", "timeFieldName": "@timestamp", "name": "Food Delivery logs"},
             "references": [], "migrationVersion": {"index-pattern": "8.0.0"}, "coreMigrationVersion": "8.5.0"})

# metrics
vis("fd-total", "Total log count", "metric", [count_agg()], METRIC)
vis("fd-errors", "Error count", "metric", [count_agg()], METRIC, "level:ERROR")
vis("fd-warnings", "Warning count", "metric", [count_agg()], METRIC, "level:WARN")
vis("fd-info", "Information logs", "metric", [count_agg()], METRIC, "level:INFO")
# breakdowns
vis("fd-by-service", "Logs by microservice", "pie", [count_agg(), terms_agg(2, "service", "segment", 20)], PIE)
vis("fd-by-level", "Logs by log level", "pie", [count_agg(), terms_agg(2, "level", "segment", 8)], PIE)
vis("fd-over-time", "Logs over time by level", "histogram", [count_agg(), date_agg(2), terms_agg(3, "level", "group", 6)], HIST)
vis("fd-exceptions", "Exception trends by class", "histogram", [count_agg(), date_agg(2), terms_agg(3, "error.class", "group", 8)], HIST, "error.class:*")
vis("fd-api", "API request activity by HTTP status", "histogram", [count_agg(), date_agg(2), terms_agg(3, "httpStatus", "group", 8)], HIST, "category:api-request")
vis("fd-kafka-prod", "Kafka producer logs by service", "histogram", [count_agg(), date_agg(2), terms_agg(3, "service", "group", 15)], HIST, "category:kafka-producer")
vis("fd-kafka-cons", "Kafka consumer logs by service", "histogram", [count_agg(), date_agg(2), terms_agg(3, "service", "group", 15)], HIST, "category:kafka-consumer")
vis("fd-redis", "Redis cache activity", "histogram", [count_agg(), date_agg(2), terms_agg(3, "service", "group", 15)], HIST, "category:redis-cache")
vis("fd-payment", "Payment operational events (no sensitive data)", "table", [count_agg(), terms_agg(2, "service", "bucket", 5), terms_agg(3, "level", "bucket", 5)], TABLE, "category:payment")
vis("fd-orders", "Order lifecycle activity", "histogram", [count_agg(), date_agg(2), terms_agg(3, "level", "group", 5)], HIST, "category:order-lifecycle")

# saved searches
for sid, title, query, cols in [
    ("fd-search-errors", "Recent errors", "level:ERROR", ["service", "logger", "message", "error.class", "correlationId"]),
    ("fd-search-correlation", "Search by correlationId / traceId (type correlationId:\"...\" or traceId:\"...\")", "", ["service", "level", "message", "correlationId", "traceId"])]:
    objs.append({"id": sid, "type": "search", "attributes": {"title": title, "description": "", "columns": cols, "sort": [["@timestamp", "desc"]],
                 "kibanaSavedObjectMeta": {"searchSourceJSON": search_source(query)}}, "references": REF_INDEX,
                 "migrationVersion": {"search": "8.0.0"}, "coreMigrationVersion": "8.5.0"})

# dashboard layout (48 columns grid)
layout = [("fd-total", 0, 0, 12, 8, "visualization"), ("fd-errors", 12, 0, 12, 8, "visualization"), ("fd-warnings", 24, 0, 12, 8, "visualization"), ("fd-info", 36, 0, 12, 8, "visualization"),
          ("fd-by-service", 0, 8, 24, 16, "visualization"), ("fd-by-level", 24, 8, 24, 16, "visualization"),
          ("fd-over-time", 0, 24, 48, 14, "visualization"),
          ("fd-search-errors", 0, 38, 48, 16, "search"),
          ("fd-exceptions", 0, 54, 24, 14, "visualization"), ("fd-api", 24, 54, 24, 14, "visualization"),
          ("fd-kafka-prod", 0, 68, 24, 14, "visualization"), ("fd-kafka-cons", 24, 68, 24, 14, "visualization"),
          ("fd-redis", 0, 82, 24, 14, "visualization"), ("fd-orders", 24, 82, 24, 14, "visualization"),
          ("fd-payment", 0, 96, 24, 14, "visualization"), ("fd-search-correlation", 24, 96, 24, 14, "search")]
panels, refs = [], []
for n, (pid, x, y, w, h, typ) in enumerate(layout):
    panels.append({"version": "8.15.3", "type": typ, "gridData": {"x": x, "y": y, "w": w, "h": h, "i": str(n)}, "panelIndex": str(n), "embeddableConfig": {}, "panelRefName": f"panel_{n}"})
    refs.append({"name": f"panel_{n}", "type": typ, "id": pid})
objs.append({"id": "fd-dashboard", "type": "dashboard", "attributes": {
    "title": "Food Delivery - Operations", "description": "Centralised Log4j2 logs: volume, errors, API traffic, Kafka, Redis, payments and orders. Type correlationId:\"<id>\" or traceId:\"<id>\" in the query bar to follow one request.",
    "panelsJSON": json.dumps(panels), "optionsJSON": json.dumps({"useMargins": True, "syncColors": False, "hidePanelTitles": False}),
    "timeRestore": True, "timeFrom": "now-24h", "timeTo": "now", "refreshInterval": {"pause": True, "value": 0},
    "kibanaSavedObjectMeta": {"searchSourceJSON": json.dumps({"query": {"query": "", "language": "kuery"}, "filter": []})}},
    "references": refs, "migrationVersion": {"dashboard": "8.7.0"}, "coreMigrationVersion": "8.5.0"})

with open("kibana-objects.ndjson", "w") as f:
    for o in objs:
        f.write(json.dumps(o) + "\n")
print(f"wrote {len(objs)} saved objects")
