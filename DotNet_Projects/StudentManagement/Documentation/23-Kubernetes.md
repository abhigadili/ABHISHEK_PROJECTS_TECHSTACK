# 23 - Kubernetes

## 1. Feature Overview
Optional manifests (kustomize) for the gateway, four services, Redis and RabbitMQ, with Deployments/StatefulSet, Services, ConfigMap, Secret template, probes and resource requests/limits. MySQL stays **outside** the cluster.

## 2. Purpose
Show how the same container images run on Kubernetes; local development does not need it.

## 3. Files Created
| File Path | Change Type | Description |
|---|---|---|
| Kubernetes/00-namespace.yaml | Created | Namespace `sms-dn` |
| Kubernetes/01-configmap.yaml | Created | Non-secret settings (service URLs, Redis, RabbitMQ host, YARP destinations) |
| Kubernetes/02-mysql-external.yaml | Created | `mysql-host` ExternalName Service pointing at the existing MySQL (edit the target) |
| Kubernetes/03-secret.yaml | Created | **Template** for `sms-secrets` (DB login, JWT secret, admin password, RabbitMQ login); intentionally not in the kustomization |
| Kubernetes/10-redis.yaml | Created | Deployment + PVC + Service |
| Kubernetes/11-rabbitmq.yaml | Created | StatefulSet (PVC 2Gi) + Service |
| Kubernetes/30-student-service.yaml ... 33-notification-service.yaml, 40-api-gateway.yaml | Created | Deployment + Service each (gateway: 2 replicas, `LoadBalancer`) |
| Kubernetes/kustomization.yaml | Created | Resource list |

## 4. Files Modified
None.

## 5. Implementation Details
- Probes: liveness `GET /health/live`, readiness `GET /health/ready` (port 8080); Redis/RabbitMQ use `redis-cli ping` / `rabbitmq-diagnostics`.
- Resources per app: requests 100m CPU / 192Mi, limits 500m / 512Mi (Redis 50m/64Mi - 250m/256Mi; RabbitMQ 100m/256Mi - 500m/768Mi).
- Connection strings are assembled from Secret values: `Server=mysql-host;...;User=$(MYSQL_USER);Password=$(MYSQL_PASSWORD);`.
- Images expected: `sms-dn/<service>:1.0.0` (built from `Docker/Dockerfile`, see `22`).
- Create the secret first:
  `kubectl -n sms-dn create secret generic sms-secrets --from-literal=MYSQL_USER=... --from-literal=MYSQL_PASSWORD=... --from-literal=Jwt__Secret=... --from-literal=Bootstrap__AdminPassword=... --from-literal=RabbitMq__UserName=... --from-literal=RabbitMq__Password=...`
- MySQL reachability from pods is the cluster owner's responsibility (network path + grant for the pod network).

## 6. Architecture Details
Service DNS names (`student-service:8080` ...) replace localhost URLs; the gateway is the only externally exposed Service.

## 7. Dependencies
A Kubernetes cluster, `kubectl` (kustomize built in).

## 8. Configuration Changes
ConfigMap `sms-config`, Secret `sms-secrets`.

## 9. Database Changes
None (services migrate their own databases at startup).

## 10. API Changes
None.

## 11. Communication Changes
In-cluster DNS; RabbitMQ and Redis as cluster services.

## 12. Execution Instructions
```bash
kubectl apply -k Kubernetes/          # after creating the secret and editing 02-mysql-external.yaml
kubectl -n sms-dn get pods
```

## 13. Testing
YAML syntax parsed successfully for all 12 files (Python `yaml` loader: 00-40 + kustomization). **The manifests were NOT applied to a cluster** (none available) - unverified at runtime.

## 14. Pending Items
Apply/verify on a real cluster; add Ingress, HPA, NetworkPolicy, Prometheus/Grafana/Jaeger manifests if needed (out of scope).
