[![OpenSSF Scorecard](https://api.scorecard.dev/projects/github.com/ossf/scorecard/badge)](https://scorecard.dev/viewer/?uri=github.comld Hardened Container Images](https://github.com/ministryofjustice/hmpps-hardened-container-images/actions/workflows/build-images.yml/badge.svg)](https://github.com/ministryofjustice/hmppsrkflows/build-images.yml)

# HMPPS Hardened Container Images

Lean, security-focused container images for Java, Node.js, and Python workloads used across HMPPS.

These images are built and published to GitHub Container Registry (GHCR) and include automated operating system patching, multi-architecture support, vulnerability scanning, and supply chain security controls.

## Available Images

| Repository | Variant |
|------------|----------|
| `ghcr.io/ministryofjustice/hmpps-hardened-eclipse-temurin-java21` | Eclipse Temurin Java 21 |
| `ghcr.io/ministryofjustice/hmpps-hardened-eclipse-temurin-java25` | Eclipse Temurin Java 25 |
| `ghcr.io/ministryofjustice/hmpps-hardened-distroless-java21` | Distroless Java 21 |
| `ghcr.io/ministryofjustice/hmpps-hardened-distroless-java25` | Distroless Java 25 |
| `ghcr.io/ministryofjustice/hmpps-hardened-alpine-node-24` | Alpine Node.js 24 |
| `ghcr.io/ministryofjustice/hmpps-hardened-alpine-node-24-runtime` | Alpine Node.js 24 Runtime (npm, yarn, and corepack removed) |
| `ghcr.io/ministryofjustice/hmpps-hardened-distroless-node` | Distroless Node.js 24 |
| `ghcr.io/ministryofjustice/hmpps-hardened-python-alpine` | Python Alpine |

All images are published for:

- `linux/amd64`
- `linux/arm64`

## Usage Examples

### Java 25 (Temurin)

```dockerfile
FROM ghcr.io/ministryofjustice/hmpps-hardened-eclipse-temurin-java25:v1.2.3
```

### Java 25 (Distroless)

```dockerfile
FROM ghcr.io/ministryofjustice/hmpps-hardened-distroless-java25:v1.2.3
```

### Node.js Runtime

```dockerfile
FROM ghcr.io/ministryofjustice/hmpps-hardened-alpine-node-24-runtime:v1.2.3
```

### Python

```dockerfile
FROM ghcr.io/ministryofjustice/hmpps-hardened-python-alpine:v1.2.3
```

## Variants

### Java

#### Eclipse Temurin

- Java 21
- Java 25

#### Distroless

- Java 21
- Java 25

### Node.js

#### Alpine

- Node.js 24

#### Alpine Runtime

- Node.js 24 runtime image with npm, yarn, and corepack removed

#### Distroless

- Node.js 24

### Python

- Python Alpine

## Tagging Scheme

Images are tagged using the Git reference name that triggered the build.

Examples:

| Git Reference | Published Tag |
|--------------|---------------|
| `main` | `main` |
| `feature/docker-updates` | `feature/docker-updates` |
| `release-2026-01` | `release-2026-01` |
| `v1.2.3` | `v1.2.3` |

For example, creating the Git tag `v1.2.3` publishes:

```text
ghcr.io/ministryofjustice/hmpps-hardened-eclipse-temurin-java25:v1.2.3
ghcr.io/ministryofjustice/hmpps-hardened-distroless-java25:v1.2.3
ghcr.io/ministryofjustice/hmpps-hardened-alpine-node-24-runtime:v1.2.3
ghcr.io/ministryofjustice/hmpps-hardened-python-alpine:v1.2.3
```

Branch-based tags are intended for development and testing only.

Production workloads should use release tags.

## Docker Image Pinning

Consumers should always pin to a specific release tag.

Recommended:

```dockerfile
FROM ghcr.io/ministryofjustice/hmpps-hardened-eclipse-temurin-java25:v1.2.3
```

Avoid floating tags such as:

```dockerfile
FROM ghcr.io/ministryofjustice/hmpps-hardened-eclipse-temurin-java25:main
```

or:

```dockerfile
FROM ghcr.io/ministryofjustice/hmpps-hardened-eclipse-temurin-java25:latest
```

For maximum supply chain integrity, pin images by digest:

```dockerfile
FROM ghcr.io/ministryofjustice/hmpps-hardened-eclipse-temurin-java25:v1.2.3@sha256:<digest>
```

Digest-pinned images are immutable and guarantee that the exact image tested is the image deployed.

## CI/CD Overview

Images are automatically built when:

- Changes are pushed to `main`
- A Git tag is created
- A pull request is opened or updated
- The workflow is manually triggered

The build pipeline includes:

- Multi-platform Docker Buildx builds
- GitHub Container Registry (GHCR) publishing
- Snyk container scanning
- GitHub code scanning integration
- Dependency and vulnerability analysis
- Automatic cancellation of superseded workflow runs

## Upgrading Base Versions

Container image definitions are managed through the workflow matrix and associated Dockerfiles.

The workflow matrix controls:

- `image_name` - published image name
- `context` - Docker build context
- `dockerfile` - Dockerfile path
- `publish_latest` - whether the image receives a `latest` tag

Example:

```yaml
- image_name: hardened-eclipse-temurin-java25
  context: images/java/eclipse-temurin
  dockerfile: images/java/eclipse-temurin/Dockerfile.java25
  publish_latest: true
```

When upgrading an image:

1. Update the Dockerfile base image reference.
2. Verify upstream image availability for both supported architectures.
3. Create and test a pull request.
4. Create a release tag.
5. Update consuming applications to use the new image version.

Consumers should always reference explicit release versions rather than floating branch tags.

## Security Updates

Where applicable, images apply operating system updates during the build process using a dedicated build stage.

Example Alpine pattern:

```dockerfile
FROM base-image AS base

FROM base AS security-upgrades

RUN apk upgrade --no-cache
```

Example Ubuntu pattern:

```dockerfile
FROM base-image AS base

FROM base AS security-upgrades

RUN apt-get update \
 && apt-get upgrade -y \
 && rm -rf /var/lib/apt/lists/*
```

The CI pipeline uses BuildKit cache filtering to ensure security update layers are always rebuilt:

```text
--no-cache-filter=security-upgrades
```

This guarantees that the latest operating system patches are applied even when other layers are served from cache.

Distroless images follow a different build pattern and do not include a dedicated `security-upgrades` stage.

## Security Scanning

All published images are scanned during CI using Snyk.

Scanning includes:

- Operating system vulnerabilities
- Package
