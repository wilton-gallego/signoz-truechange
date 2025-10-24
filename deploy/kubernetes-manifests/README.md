# Trueview Kubernetes Manifests

These manifests provide a Helm-free installation path for deploying the Trueview observability stack (formerly SigNoz) on any Kubernetes cluster, including Oracle Container Engine for Kubernetes (OKE).

## Contents

* `00-namespace.yaml` – creates the dedicated `trueview` namespace.
* `01-clickhouse-config.yaml` – configuration ConfigMap for ClickHouse.
* `02-query-config.yaml` – Prometheus configuration for the query service.
* `03-collector-config.yaml` – OpenTelemetry Collector configuration and OpAMP manager settings.
* `10-storage.yaml` – persistent volume claims for ClickHouse, the query service metadata store, and Zookeeper.
* `20-zookeeper.yaml` – headless Service and StatefulSet for the Zookeeper quorum (single replica by default).
* `30-clickhouse.yaml` – headless Service and StatefulSet for ClickHouse with the histogramQuantile helper init container.
* `40-schema-migrator.yaml` – sync Job and async Deployment for ClickHouse schema migrations.
* `50-query-service.yaml` – Deployment and Services for the Trueview query service (API, UI, OpAMP endpoint).
* `60-otel-collector.yaml` – Deployment and Service for the OpenTelemetry Collector ingress point.

Apply the manifests in numerical order:

```bash
kubectl apply -f deploy/kubernetes-manifests/00-namespace.yaml
kubectl apply -f deploy/kubernetes-manifests/01-clickhouse-config.yaml
kubectl apply -f deploy/kubernetes-manifests/02-query-config.yaml
kubectl apply -f deploy/kubernetes-manifests/03-collector-config.yaml
kubectl apply -f deploy/kubernetes-manifests/10-storage.yaml
kubectl apply -f deploy/kubernetes-manifests/20-zookeeper.yaml
kubectl apply -f deploy/kubernetes-manifests/30-clickhouse.yaml
kubectl apply -f deploy/kubernetes-manifests/40-schema-migrator.yaml
kubectl apply -f deploy/kubernetes-manifests/50-query-service.yaml
kubectl apply -f deploy/kubernetes-manifests/60-otel-collector.yaml
```

> ℹ️  Wait for the ClickHouse StatefulSet to become `Ready` before applying `40-schema-migrator.yaml`. On OKE, use the `oci-bv` storage class in `10-storage.yaml` to back the persistent volumes with OCI Block Volumes.

## Post-installation tasks

1. Record the external IPs allocated to the `trueview-ui` (port 80/8080) and `trueview-otel-collector` (ports 4317/4318) services and wire DNS accordingly.
2. Update organization information and invite collaborators from **Settings → General**.
3. Configure retention, alerts, and integrations inside the product UI.

To remove the stack, delete the namespace:

```bash
kubectl delete namespace trueview
```

