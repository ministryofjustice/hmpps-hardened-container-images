[![OpenSSF Scorecard](https://api.scorecard.dev/projects/github.com/ministryofjustice/hmpps-hardened-container-images/badge)](https://scorecard.dev/viewer/?uri=github.com/ministryofjustice/hmpps-hardened-container-images)
[![Build Hardened Container Images](https://github.com/ministryofjustice/hmpps-hardened-container-images/actions/workflows/build-images.yml/badge.svg)](https://github.com/ministryofjustice/hmpps-hardened-container-images/actions/workflows/build-images.yml)
![GitHub Release](https://img.shields.io/github/v/release/ministryofjustice%2Fhmpps-hardened-container-images)

Security-hardened, production-ready container images for HMPPS services.

These images are automatically built, scanned, and published to GitHub Container Registry (GHCR) with support for:

- 🔒 Secure base images
- 🛡️ Snyk vulnerability scanning
- 📦 GitHub Container Registry publishing
- 🌍 Multi-architecture builds (`amd64` and `arm64`)
- 🔄 Automated operating system updates
- 🚀 Release-based versioning
- ✅ Supply chain security controls
- 🔍 GitHub code scanning integration

---

## Available Images

### Java

#### Eclipse Temurin

| Image | Description |
|---------|-------------|
| `ghcr.io/ministryofjustice/hmpps-hardened-eclipse-temurin-java21` | Eclipse Temurin Java 21 |
| `ghcr.io/ministryofjustice/hmpps-hardened-eclipse-temurin-java25` | Eclipse Temurin Java 25 |

#### Distroless

| Image | Description |
|---------|-------------|
| `ghcr.io/ministryofjustice/hmpps-hardened-distroless-java21` | Distroless Java 21 |
| `ghcr.io/ministryofjustice/hmpps-hardened-distroless-java25` | Distroless Java 25 |

---

### Node.js

| Image | Description |
|---------|-------------|
| `ghcr.io/ministryofjustice/hmpps-hardened-alpine-node-24` | Alpine Node.js 24 |
| `ghcr.io/ministryofjustice/hmpps-hardened-alpine-node-runtime-24` | Alpine runtime image with npm, yarn and corepack removed |
| `ghcr.io/ministryofjustice/hmpps-hardened-distroless-node-24` | Distroless Node.js 24 |

---

### Python

| Image | Description |
|---------|-------------|
| `ghcr.io/ministryofjustice/hmpps-hardened-python-alpine-3-13` | Python 3.13 Alpine |

---

## Supported Platforms

All published container images support:

- `linux/amd64`
- `linux/arm64`

Pulling the same tag automatically retrieves the correct image for your platform.

---

## Usage

### Java 25 (Temurin)

```dockerfile
FROM ghcr.io/ministryofjustice/hmpps-hardened-eclipse-temurin-java25:v1.0.0
```

### Java 25 (Distroless)

```dockerfile
FROM ghcr.io/ministryofjustice/hmpps-hardened-distroless-java25:v1.0.0
```

### Node Runtime

```dockerfile
FROM ghcr.io/ministryofjustice/hmpps-hardened-alpine-node-runtime-24:v1.0.0
```

### Python

```dockerfile
FROM ghcr.io/ministryofjustice/hmpps-hardened-python-alpine-3-13:v1.0.0
```

---

## Release Management

This repository uses **Release Please** for automated semantic versioning and releases.

Current version:

<!-- x-release-please-version -->
`v1.0.0`

Creating a release tag publishes versioned images to GHCR.

Example:

```text
v1.2.3
```

Produces:

```text
ghcr.io/ministryofjustice/hmpps-hardened-eclipse-temurin-java25:v1.2.3
ghcr.io/ministryofjustice/hmpps-hardened-distroless-java25:v1.2.3
ghcr.io/ministryofjustice/hmpps-hardened-alpine-node-runtime-24:v1.2.3
ghcr.io/ministryofjustice/hmpps-hardened-python-alpine-3-13:v1.2.3
```

Development builds are tagged using the current branch name.

Example:

```text
main
feature/improve-security
```

These tags should not be used for production deployments.

---

## CI/CD Pipeline

The workflow runs when:

- Code is pushed to `main`
- A Git tag is created
- A pull request is opened or updated
- The workflow is manually triggered

### Pipeline Stages

```text
Checkout
    ↓
DevSecOps Checks
    ↓
Build Container Image
    ↓
Multi-Architecture Packaging
    ↓
Snyk Vulnerability Scan
    ↓
Publish to GHCR
    ↓
GitHub Security Reporting
```

---

## Security

Security is a core design objective of these images.

Features include:

- Minimal attack surface
- Regular upstream base image updates
- Vulnerability scanning via Snyk
- GitHub Security integration
- Immutable image digests
- Pinned GitHub Actions
- Multi-stage image builds
- Automated OS patching where supported

### Alpine Security Updates

```dockerfile
FROM base AS security-upgrades

RUN apk upgrade --no-cache
```

### Ubuntu/Debian Security Updates

```dockerfile
FROM base AS security-upgrades

RUN apt-get update \
 && apt-get upgrade -y \
 && rm -rf /var/lib/apt/lists/*
```

BuildKit cache filtering ensures security update layers are always rebuilt:

```text
--no-cache-filter=security-upgrades
```

---

## Image Pinning

Production workloads should always pin to a specific release version.

Recommended:

```dockerfile
FROM ghcr.io/ministryofjustice/hmpps-hardened-eclipse-temurin-java25:v1.2.3
```

For maximum supply-chain integrity, pin by digest:

```dockerfile
FROM ghcr.io/ministryofjustice/hmpps-hardened-eclipse-temurin-java25:v1.2.3@sha256:<digest>
```

Avoid:

```dockerfile
FROM ghcr.io/ministryofjustice/hmpps-hardened-eclipse-temurin-java25:latest
```

or

```dockerfile
FROM ghcr.io/ministryofjustice/hmpps-hardened-eclipse-temurin-java25:main
```

---

## Repository Structure

```text
images/
├── java/
│   ├── eclipse-temurin/
│   └── distroless/
├── node/
│   ├── alpine/
│   ├── alpine-runtime/
│   └── distroless/
└── python/
    └── alpine/
```

---

## Publishing

Images are published to:

```text
ghcr.io/ministryofjustice
```

Example:

```text
ghcr.io/ministryofjustice/hmpps-hardened-eclipse-temurin-java25
```

---

## Contributing

1. Update the relevant Dockerfile.
2. Test locally.
3. Open a pull request.
4. Ensure security scans pass.
5. Merge to `main`.
6. Allow Release Please to generate a release PR.
7. Publish a release and consume the new image tag.

---

## License

Released under the MIT License unless otherwise specified.
