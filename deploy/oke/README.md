# Deploying Trueview on Oracle Container Engine for Kubernetes (OKE)

This guide summarizes the changes required to run the Trueview stack on Oracle Cloud Infrastructure (OCI) using an OKE managed Kubernetes cluster.

## Prerequisites

- An OCI account with permissions to create and manage OKE clusters.
- The [OCI CLI](https://docs.oracle.com/en-us/iaas/Content/API/SDKDocs/cliinstall.htm) configured with an API key that can create compute resources.
- `kubectl` configured to talk to the OKE cluster.
- Docker images for the Trueview components hosted in a registry accessible from OKE. You can continue using the upstream SigNoz images until bespoke Trueview builds are available.
- Object storage bucket for backups (optional but recommended).

## 1. Create or Update an OKE Cluster

Provision a new OKE cluster or reuse an existing one. The default Virtual Cloud Network (VCN) created by OKE is sufficient, but ensure that worker nodes have outbound internet access to pull container images from your registry.

```bash
oci ce cluster create \
  --name trueview-oke \
  --kubernetes-version "v1.29.1" \
  --compartment-id <compartment-ocid> \
  --vcn-id <vcn-ocid> \
  --shape "VM.Standard.E4.Flex" \
  --node-pool-options '{"size":3,"shape":"VM.Standard.E4.Flex","ocpus":2,"memoryInGBs":16}'
```

Download kubeconfig credentials once the cluster becomes ACTIVE:

```bash
oci ce cluster create-kubeconfig \
  --cluster-id <cluster-ocid> \
  --file ~/.kube/trueview-oke.yaml \
  --region <region> \
  --token-version 2.0.0
export KUBECONFIG=~/.kube/trueview-oke.yaml
kubectl get nodes
```

## 2. Configure Namespace and Secrets

Create a dedicated namespace for Trueview and configure credentials (for example ClickHouse password, Slack webhook tokens, etc.).

```bash
kubectl create namespace trueview
kubectl -n trueview create secret generic clickhouse-secret \
  --from-literal=CLICKHOUSE_PASSWORD='<secure-password>'
```

## 3. Prepare Helm Values

SigNoz publishes a Helm chart that we can reuse while custom builds are being prepared. Create a `values.trueview.yaml` file that overrides the branding and persistence settings.

```yaml
# values.trueview.yaml
global:
  frontend:
    env:
      - name: REACT_APP_BRAND_NAME
        value: "Trueview"
  persistence:
    storageClass: "oci-bv"
    size: 100Gi
collector:
  resources:
    limits:
      cpu: 2
      memory: 4Gi
frontend:
  service:
    type: LoadBalancer
    annotations:
      service.beta.kubernetes.io/oci-load-balancer-shape: "flexible"
      service.beta.kubernetes.io/oci-load-balancer-shape-flex-min: "10"
      service.beta.kubernetes.io/oci-load-balancer-shape-flex-max: "100"
```

Use the OCI Block Volume storage class (`oci-bv`) for stateful components such as ClickHouse and Kafka/Zookeeper.

## 4. Install the Stack

Add the SigNoz Helm repository and install the release into the namespace created earlier.

```bash
helm repo add trueview https://signoz.github.io/charts
helm repo update
helm upgrade --install trueview trueview/signoz -n trueview -f values.trueview.yaml
```

Monitor the rollout:

```bash
kubectl -n trueview get pods -w
```

## 5. Configure Ingress and DNS

OKE provisions an OCI Load Balancer for services of type `LoadBalancer`. Record the public IP and create a DNS record (for example `monitoring.yourdomain.com`). Optionally terminate TLS at the load balancer using an OCI certificate.

## 6. Post-Deployment Checks

1. Access the Trueview UI via the load balancer endpoint.
2. Update organization details and invite users from **Settings → General**.
3. Configure retention policies and integrations from the onboarding wizard.
4. Set up OCI logging pipelines to push telemetry to the OpenTelemetry Collector endpoint exposed by the deployment.

## 7. Automating Upgrades

For GitOps-friendly upgrades, store the `values.trueview.yaml` file in source control and manage releases via OCI DevOps or Argo CD. Test upgrades in a staging OKE cluster before promoting to production.

---

These steps reuse the upstream deployment assets while the Trueview-specific container images and Helm charts are being prepared. Once bespoke images are available, update the image references in `values.trueview.yaml` to complete the rebranding.
