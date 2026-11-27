# 25 – Kubernetes

## 1. Feature Overview
Optional manifests (Kustomize) for namespace `student-management`: Eureka, gateway, the four services, Kafka (KRaft StatefulSet), Redis (StatefulSet), ConfigMap, Secret, and an alias Service for the **external** MySQL.

## 2. Purpose
Deployability on a cluster without changing application code; local development does not need it.

## 3. Files Created
| File Path | Change Type | Description |
|---|---|---|
| kubernetes/00-namespace.yaml | Created | Namespace |
| kubernetes/01-configmap.yaml | Created | `sms-config`: MYSQL_HOST/PORT, EUREKA_URL, REDIS_HOST, KAFKA_BOOTSTRAP_SERVERS, OTLP endpoint, CORS, JSON logging |
| kubernetes/02-mysql-external.yaml | Created | Selector-less `Service` + `Endpoints` (`mysql-external` → your MySQL IP, **placeholder** `192.168.1.10`) |
| kubernetes/03-secret.yaml | Created | `sms-secrets` with `CHANGE_ME` placeholders (MYSQL_USER, MYSQL_PASSWORD, JWT_SECRET, ADMIN_PASSWORD) |
| kubernetes/10-redis.yaml | Created | StatefulSet (1 Gi PVC, AOF) + Service |
| kubernetes/11-kafka.yaml | Created | StatefulSet (5 Gi PVC) + Service |
| kubernetes/20-eureka-server.yaml | Created | Deployment + Service |
| kubernetes/30-student-service.yaml, 31-course-service.yaml, 32-enrollment-service.yaml (2 replicas), 33-notification-service.yaml | Created | Deployments + Services |
| kubernetes/40-api-gateway.yaml | Created | Deployment (2 replicas) + NodePort 30080 |
| kubernetes/kustomization.yaml | Created | Lists all resources |

## 4. Files Modified
None.

## 5. Implementation Details
Every Deployment/StatefulSet has: `startupProbe` (liveness URL, up to 3 min), `livenessProbe` (`/actuator/health/liveness`), `readinessProbe` (`/actuator/health/readiness`), resource requests/limits (apps 200m/384Mi → 1 CPU/768Mi), `envFrom` ConfigMap (+ Secret for DB-using pods and the gateway). Images `sms/<service>:1.0.0` (`imagePullPolicy: IfNotPresent`; push to your registry and adjust the names). MySQL is reached via `MYSQL_HOST=mysql-external`.

## 6. Architecture Details
Eureka stays in use inside the cluster (names `eureka-server`, Feign/Gateway `lb://`); the gateway is the only externally exposed Service.

## 7. Dependencies
A cluster with a default StorageClass; the images; reachability of the external MySQL from the nodes; MySQL user allowed from the node/pod CIDR.

## 8. Configuration Changes
Edit `02-mysql-external.yaml` (IP) and create the real Secret before applying.

## 9. Database Changes
None (services run Flyway on startup against the external MySQL).

## 10. API Changes
Gateway on NodePort `30080` (use an Ingress/LoadBalancer in real clusters).

## 11. Communication Changes
In-cluster DNS: `kafka:9092`, `redis:6379`, `eureka-server:8761`, `mysql-external:3306`.

## 12. Execution Instructions
```bash
kubectl apply -f kubernetes/00-namespace.yaml
kubectl -n student-management create secret generic sms-secrets \
  --from-literal=MYSQL_USER=... --from-literal=MYSQL_PASSWORD=... \
  --from-literal=JWT_SECRET=$(openssl rand -hex 32) --from-literal=ADMIN_PASSWORD=...
kubectl apply -k kubernetes/      # (skip 03-secret.yaml if you created the Secret yourself)
kubectl -n student-management get pods -w
```

## 13. Testing – what was verified
Only structural validation: all 13 files parse as YAML (22 objects); a script checked that every workload has matching selector/labels, liveness + readiness probes and requests+limits. **No `kubectl`/cluster was available, so nothing was applied or run** (kubectl dry-run/kubeconform not executed).

## 14. Pending Items
Not deployed or runtime-tested; Kafka/Redis are single-node demo sizing; no Ingress, NetworkPolicy, PodDisruptionBudget, HPA, or Prometheus/Grafana/Jaeger manifests (the ConfigMap points at a `jaeger` Service that you must provide or ignore – tracing export just logs a warning without it).
