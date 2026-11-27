#!/usr/bin/env python3
"""
Writes docs/generated/order-trace.md: ONE real order followed across the platform by its correlation id
(HTTP access logs from Elasticsearch + the Kafka events of the audit store). Run after scripts/e2e.py.
    python3 scripts/gen_trace_doc.py [correlationId]
"""
import json, os, re, sys, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ENV = dict(l.strip().split("=", 1) for l in open(os.path.join(ROOT, ".env")) if "=" in l and not l.startswith("#"))
GW = "http://localhost:9080"
cid = sys.argv[1] if len(sys.argv) > 1 else open(os.path.join(ROOT, ".run", "last-order-cid.txt")).read().strip()


def call(path, token):
    req = urllib.request.Request(GW + path, headers={"Authorization": "Bearer " + token})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read().decode())


body = json.dumps({"usernameOrEmail": "superadmin", "password": ENV["BOOTSTRAP_ADMIN_PASSWORD"]}).encode()
tok = json.loads(urllib.request.urlopen(urllib.request.Request(GW + "/api/auth/login", data=body, headers={"Content-Type": "application/json"}), timeout=30).read())["accessToken"]
logs = call(f"/api/logs/correlation/{cid}?size=200", tok)["hits"]
audit = call(f"/api/audit/trace/{cid}", tok)

out = [f"**Correlation id `{cid}`**: the id the browser/test client sent in `X-Correlation-Id` when it placed the order. Everything below was found by searching that one value.\n"]
out.append("#### a) Log lines in Elasticsearch (Log4j2 → Logstash → Elasticsearch), oldest first\n")
out.append("| Time (UTC) | Service | Level | Category | Message |\n|---|---|---|---|---|")
keep = [h for h in logs if h.get("category") in ("api-request", "kafka-producer", "kafka-consumer", "order-lifecycle", "payment") or "Order" in h.get("message", "")]
for h in keep[:45]:
    msg = re.sub(r"\s+", " ", h["message"])[:110].replace("|", "\\|")
    out.append(f"| {h['@timestamp'][11:23]} | {h['service']} | {h['level']} | {h.get('category','')} | {msg} |")
out.append(f"\n({len(logs)} log lines carried this correlation id; the table shows the request, Kafka and order-lifecycle lines.)\n")
out.append("#### b) The Kafka events of the same request (persistent audit store)\n")
out.append("| Event time | Kind | Event | Topic / partition@offset | Producer or consumer | Status |\n|---|---|---|---|---|---|")
for a in audit:
    who = a["producerService"] if a["role"] == "PUBLISHED" else f"{a['consumerService']} / {a['consumerClass']}"
    out.append(f"| {(a.get('eventTimestamp') or '')[11:23]} | {a['role']} | {a['eventType']} | `{a['topic']}` {a['partition']}@{a['offset']} | {who} | {a['status']} |")
os.makedirs(os.path.join(ROOT, "docs", "generated"), exist_ok=True)
open(os.path.join(ROOT, "docs", "generated", "order-trace.md"), "w").write("\n".join(out) + "\n")
print("wrote docs/generated/order-trace.md", len(logs), "log lines,", len(audit), "audit rows")
