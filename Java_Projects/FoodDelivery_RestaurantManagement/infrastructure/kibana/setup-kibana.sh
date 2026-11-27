#!/usr/bin/env bash
# Imports the data view + dashboard into Kibana (idempotent: overwrite=true).   usage: setup-kibana.sh [kibana-url]
cd "$(dirname "$0")" || exit 1
KB="${1:-${KIBANA_URL:-http://localhost:5601}}"
python3 build_dashboard.py || exit 1
for _ in $(seq 1 60); do curl -s "$KB/api/status" | grep -q '"level":"available"' && break; sleep 3; done
curl -s -X POST "$KB/api/saved_objects/_import?overwrite=true" -H "kbn-xsrf: true" --form file=@kibana-objects.ndjson
echo
curl -s -X POST "$KB/api/kibana/settings" -H "kbn-xsrf: true" -H "Content-Type: application/json" -d '{"changes":{"defaultIndex":"food-logs"}}' >/dev/null
echo "Dashboard: $KB/app/dashboards#/view/fd-dashboard"
