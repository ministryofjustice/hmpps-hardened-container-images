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

Images are grouped by ecosystem/type beneath
`ghcr.io/ministryofjustice/hmpps-hardened-container-images/`.
Tags use `<flavour>-<branch-or-release>`, including the build method to prevent
Docker/apko collisions. For example, `node-alpine:24-npm11-apko-main` and
`node-alpine:24-npm11-docker-v1.2.3`.
Only the new grouped paths are published; old package names are no longer
updated. There is no shared `latest` tag. Docker labels and apko annotations link
packages to this source repository; GHCR Actions write permissions are still
required if an existing package does not inherit repository access.

### Java

#### Eclipse Temurin

| Image | Description |
|---------|-------------|
| `ghcr.io/ministryofjustice/hmpps-hardened-container-images/java-temurin:21-docker-main` | Eclipse Temurin Java 21 |
| `ghcr.io/ministryofjustice/hmpps-hardened-container-images/java-temurin:25-docker-main` | Eclipse Temurin Java 25 |

#### Distroless

| Image | Description |
|---------|-------------|
| `ghcr.io/ministryofjustice/hmpps-hardened-container-images/java-distroless:21-docker-main` | Distroless Java 21 |
| `ghcr.io/ministryofjustice/hmpps-hardened-container-images/java-distroless:25-docker-main` | Distroless Java 25 |

---

### Node.js

| Image | Description |
|---------|-------------|
| `ghcr.io/ministryofjustice/hmpps-hardened-container-images/node-alpine:24-npm11-docker-main` | Docker Node.js 24/npm 11 build baseline with apk |
| `ghcr.io/ministryofjustice/hmpps-hardened-container-images/node-alpine:24-npm12-docker-main` | Docker Node.js 24/npm 12 build baseline with apk |
| `ghcr.io/ministryofjustice/hmpps-hardened-container-images/node-alpine:26-npm12-docker-main` | Docker Node.js 26/npm 12 build baseline with apk |
| `ghcr.io/ministryofjustice/hmpps-hardened-container-images/node-alpine:24-npm11-apko-main` | Apko Node.js 24 build image with Melange-packaged npm 11 and apk |
| `ghcr.io/ministryofjustice/hmpps-hardened-container-images/node-alpine:24-npm12-apko-main` | Apko Node.js 24 build image with Melange-packaged npm 12 and apk |
| `ghcr.io/ministryofjustice/hmpps-hardened-container-images/node-alpine:26-npm12-apko-main` | Apko Node.js 26 build image with Melange-packaged npm 12 and apk |
| `ghcr.io/ministryofjustice/hmpps-hardened-container-images/node-alpine-runtime:24-docker-main` | Docker Node.js 24 runtime without package managers |
| `ghcr.io/ministryofjustice/hmpps-hardened-container-images/node-alpine-runtime:24-apko-main` | Apko Node.js 24 runtime without any package managers |
| `ghcr.io/ministryofjustice/hmpps-hardened-container-images/node-alpine-runtime:26-docker-main` | Docker Node.js 26 runtime without package managers |
| `ghcr.io/ministryofjustice/hmpps-hardened-container-images/node-alpine-runtime:26-apko-main` | Apko Node.js 26 runtime without any package managers |
| `ghcr.io/ministryofjustice/hmpps-hardened-container-images/node-alpine-runtime:24-scanners-apko-main` | Apko Node runtime with Scorecard, Conftest, Betterleaks, Hadolint and Snyk; no Go toolchain |
| `ghcr.io/ministryofjustice/hmpps-hardened-container-images/node-distroless:24-docker-main` | Distroless Node.js 24 |

See [Node flavours and comparison reports](images/node/README.md) for local builds
and pipeline measurements of vulnerabilities, image size, build duration, versions
and package-manager presence. Docker and apko runtime flavours exclude package
managers; use build flavours to install packages. The scanner flavour remains separate.

---

### Python

| Image | Description |
|---------|-------------|
| `ghcr.io/ministryofjustice/hmpps-hardened-container-images/python-alpine:3.13-docker-main` | Python 3.13 Alpine |

---

## Dependency Updates

Enable the Renovate GitHub App for this repository to activate `renovate.json`.
Renovate opens pull requests for Docker base-image tags and digests, GitHub Actions,
pre-commit hooks, annotated Dockerfile package versions, and pinned package versions
in the Node Alpine runtime apko config. The separately published apko variant uses Alpine's
prebuilt `nodejs~24` or `nodejs-current~26` packages, and build/runtime configs are
rendered from `images/node/alpine-runtime/apko.yaml` using only Alpine 3.24
main/community. The scanner flavour retains its existing edge repository for
the pinned build-only Go compiler. npm 11/12 distributions are checksum-pinned in
their Melange recipes. Updates require review
and CI; automatic merging is not enabled. The Dependency Dashboard tracks pending
updates and lookup failures.

Custom regex managers cover pinned CA/libstdc++ packages in apko and Melange
YAML, npm 11/12 recipe versions, and the five scanner release sources. Node major
constraints and the explicitly required Go 1.27.2 compiler remain unchanged.
Unpinned Alpine packages are refreshed by rebuilds, not version-only Renovate edits.
Apko/Melange updates are grouped into reviewable PRs with automerge disabled.

The [Melange synchronization workflow](.github/workflows/sync-melange.yml) handles
same-repository `renovate[bot]` PRs on `renovate/` branches. It runs the synchronizer
from the trusted base commit, downloads changed release archives over verified
HTTPS, checks npm archives against registry SHA-512 integrity, and updates:

- Melange SHA-256/SHA-512 checksums.
- Scanner linker versions, runtime assertions and documentation.
- Scanner package epochs and workflow/Makefile APK pins.
- npm package versions and corresponding workflow/Makefile pins.

Configure the repository secret **`MELANGE_SYNC_TOKEN`** with a token restricted
to this repository and **Contents, Workflows and Actions write** permissions.
Workflows write is necessary because the synchronized pins include the build
workflow; Actions write allows an explicit validation dispatch. Classic PATs
require suitable `repo` and `workflow` scopes instead. Organization approval and
branch rules may also apply. No credentials are passed to dependency archives.
The workflow must exist on the PR base before it can synchronize updates.
Other bot identities/branch prefixes are intentionally not authorized.
The branch is committed and a build is dispatched; no updates are auto-merged.
Missing credentials, checksum mismatches and unsupported source changes fail
explicitly. Snyk's separate npm build-tool version remains tied to its upstream
engine requirement rather than following the runtime npm recipe.

Keep an explicit tag alongside each base-image digest so Renovate follows the
intended runtime and operating-system variant rather than `latest`. Container
major-version upgrades are disabled to preserve the published image contracts;
Node Alpine stays on Node 24, Python stays on 3.13, and the npm 12 variant stays
on npm 12. New runtime majors should be introduced deliberately as new variants.

For a pinned package argument, put its lookup metadata immediately above the ARG:

```dockerfile
# renovate: datasource=npm depName=npm
ARG NPM_VERSION=12.2.0

# renovate: datasource=repology depName=alpine_3_24/libstdc++ versioning=loose
ARG LIBSTDCXX_VERSION=15.2.0-r5
```

Keep Alpine package annotations aligned with the Alpine release in the base-image
tag. npm installs use the registry's integrity verification rather than a separate
hard-coded checksum that would become stale on version updates. Unpinned OS
packages (including tzdata) are resolved during builds, not by Renovate. Existing
`apk upgrade` and `apt-get upgrade` stages still apply available OS patches when
rebuilt; this configuration does not schedule rebuilds by itself.

Dependabot remains configured independently and may open overlapping update PRs.

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
FROM ghcr.io/ministryofjustice/hmpps-hardened-container-images/java-temurin:25-docker-v1.0.0
```

### Java 25 (Distroless)

```dockerfile
FROM ghcr.io/ministryofjustice/hmpps-hardened-container-images/java-distroless:25-docker-v1.0.0
```

### Node Runtime

```dockerfile
FROM ghcr.io/ministryofjustice/hmpps-hardened-container-images/node-alpine-runtime:24-apko-v1.0.0
```

### Python

```dockerfile
FROM ghcr.io/ministryofjustice/hmpps-hardened-container-images/python-alpine:3.13-docker-v1.0.0
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
ghcr.io/ministryofjustice/hmpps-hardened-container-images/java-temurin:25-docker-v1.2.3
ghcr.io/ministryofjustice/hmpps-hardened-container-images/java-distroless:25-docker-v1.2.3
ghcr.io/ministryofjustice/hmpps-hardened-container-images/node-alpine-runtime:24-apko-v1.2.3
ghcr.io/ministryofjustice/hmpps-hardened-container-images/python-alpine:3.13-docker-v1.2.3
```

Development builds are tagged using the current branch name.

Example:

```text
24-npm11-apko-main
24-npm11-apko-feature-improve-security
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
FROM ghcr.io/ministryofjustice/hmpps-hardened-container-images/java-temurin:25-docker-v1.2.3
```

For maximum supply-chain integrity, pin by digest:

```dockerfile
FROM ghcr.io/ministryofjustice/hmpps-hardened-container-images/java-temurin:25-docker-v1.2.3@sha256:<digest>
```

Avoid:

```dockerfile
FROM ghcr.io/ministryofjustice/hmpps-hardened-container-images/java-temurin:latest
```

or

```dockerfile
FROM ghcr.io/ministryofjustice/hmpps-hardened-container-images/java-temurin:25-docker-main
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
ghcr.io/ministryofjustice/hmpps-hardened-container-images/<ecosystem-type>
```

Example:

```text
ghcr.io/ministryofjustice/hmpps-hardened-container-images/java-temurin:25-docker-main
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
