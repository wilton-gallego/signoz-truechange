# Deploying Trueview on Oracle Container Engine for Kubernetes (OKE)

This guide covers a Helm-free rollout of the Trueview observability stack on Oracle Cloud Infrastructure (OCI) using an OKE managed Kubernetes cluster.

## Prerequisites

- An OCI account with permissions to create and manage OKE clusters.
- The [OCI CLI](https://docs.oracle.com/en-us/iaas/Content/API/SDKDocs/cliinstall.htm) configured with an API key that can create compute resources.
- `kubectl` configured to talk to the target OKE cluster.
- Docker images for the Trueview components hosted in a registry accessible from OKE (the upstream SigNoz images work while bespoke builds are being prepared).
- Optional: an Object Storage bucket for ClickHouse backups.

## 1. Create or Update an OKE Cluster

Provision a new OKE cluster or reuse an existing one. Ensure worker nodes have outbound internet access to pull container images from your registry.

```bash
oci ce cluster create \
  --name trueview-oke \
  --kubernetes-version "v1.29.1" \
  --compartment-id <compartment-ocid> \
  --vcn-id <vcn-ocid> \
  --shape "VM.Standard.E4.Flex" \
  --node-pool-options '{"size":3,"shape":"VM.Standard.E4.Flex","ocpus":2,"memoryInGBs":16}'
```

Download kubeconfig credentials once the cluster is ACTIVE:

```bash
oci ce cluster create-kubeconfig \
  --cluster-id <cluster-ocid> \
  --file ~/.kube/trueview-oke.yaml \
  --region <region> \
  --token-version 2.0.0
export KUBECONFIG=~/.kube/trueview-oke.yaml
kubectl get nodes
```

## 2. Apply the Trueview Manifests

The repository ships with pre-rendered Kubernetes manifests under `deploy/kubernetes-manifests`. They are ordered so you can apply them sequentially with `kubectl`.

1. Review `deploy/kubernetes-manifests/10-storage.yaml` and confirm the `storageClassName` values match your OCI Block Volume storage class (default `oci-bv`).
2. Apply the manifests:

```bash
kubectl apply -f deploy/kubernetes-manifests/00-namespace.yaml
for manifest in 01-clickhouse-config.yaml 02-query-config.yaml 03-collector-config.yaml \
                 10-storage.yaml 20-zookeeper.yaml 30-clickhouse.yaml \
                 40-schema-migrator.yaml 50-query-service.yaml 60-otel-collector.yaml; do
  kubectl apply -f deploy/kubernetes-manifests/$manifest
  sleep 3
done
```

3. Watch the rollout:

```bash
kubectl -n trueview get pods -w
```

Wait until the `trueview-clickhouse` StatefulSet reports `READY 1/1` before the schema migrator Job runs to completion.

## 3. Expose the UI and Collector Endpoints

OKE automatically provisions an OCI Load Balancer for the services declared as `LoadBalancer` type:

- `trueview-ui` exposes the product UI on port 80 (target container port 8080).
- `trueview-otel-collector` exposes OTLP gRPC (4317) and OTLP HTTP (4318) for telemetry ingestion.

Retrieve the public IPs:

```bash
kubectl -n trueview get svc trueview-ui trueview-otel-collector
```

Update DNS records to map friendly hostnames (for example `observability.example.com`) to these load balancer addresses. Attach OCI-issued TLS certificates if required.

## 4. Post-Deployment Tasks

1. Access the Trueview UI via the `trueview-ui` load balancer address.
2. Update organization settings, invite users, and configure alert destinations.
3. Connect your applications to the OTLP endpoint served by `trueview-otel-collector`.
4. Set up scheduled ClickHouse backups using OCI Object Storage if you require disaster recovery.

## 5. Upgrades and GitOps

Store the manifest directory in your infrastructure repository and manage changes through OCI DevOps, Argo CD, or Flux for GitOps workflows. Test upgrades in a staging OKE cluster before promoting to production. When bespoke Trueview container images become available, update the image tags in the manifests and re-apply them.

To uninstall the stack:

```bash
kubectl delete namespace trueview
```

