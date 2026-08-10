# HMPPS Base Container Images

Lean, security-focused base images for Java (Temurin and distroless), Node.js (Alpine and distroless), and Python applications used across HMPPS.

## Repositories

| Image family | Repository | Example pull |
|--------------|------------|--------------|
| Java (Temurin JRE) | `ghcr.io/ministryofjustice/hmpps-eclipse-temurin` | `docker pull ghcr.io/ministryofjustice/hmpps-eclipse-temurin:21-jre-jammy` |
| Java (Distroless) | `ghcr.io/ministryofjustice/hmpps-distroless-java` | `docker pull ghcr.io/ministryofjustice/hmpps-distroless-java:25-jre` |
| Node.js (Alpine) | `ghcr.io/ministryofjustice/hmpps-node` | `docker pull ghcr.io/ministryofjustice/hmpps-node:24-alpine` |
| Node.js (Distroless) | `ghcr.io/ministryofjustice/hmpps-distroless-node` | `docker pull ghcr.io/ministryofjustice/hmpps-distroless-node:24` |
| Python | `ghcr.io/ministryofjustice/hmpps-python` | `docker pull ghcr.io/ministryofjustice/hmpps-python:python3.13-alpine` |

## Variants

Java:
- `21-jre-jammy`
- `25-jre-jammy`
- `21-jre` (distroless)
- `25-jre` (distroless)

Node:
- `24-alpine` `npm 11.x`
- `24-alpine-npm12` `npm 12.x`
- `24-alpine-runtime` — same as `24-alpine` but with package managers (npm, yarn, corepack) removed
- `24` (distroless)

Python:
- `python3.13-alpine`

All images are built multi-arch: `linux/amd64` and `linux/arm64`.

## Tagging Scheme

Each variant always has its raw variant tag (e.g. `21-jre-jammy`). Additional dynamic tags are **prefixed by the variant** to avoid collisions:

| Tag Type | Example | When Present |
|----------|---------|--------------|
| Schedule date | `21-jre-jammy-20251120` | Only on weekday 05:00 UTC scheduled build |
| Branch | `21-jre-jammy-initial-commit` | On branch builds (non-schedule) |
| PR | `21-jre-jammy-pr-123` | On pull request builds (if enabled) |
| Git SHA | `21-jre-jammy-sha-<shortsha>` | All builds |
| Raw variant | `21-jre-jammy` | All builds |

The `:latest` tag is selectively enabled per matrix entry in CI. Consumers should prefer explicit variant tags.

## CI/CD Overview

- Weekday scheduled build: 05:00 UTC (creates date tags)
- Push to `main`, PR, and manual dispatch builds are enabled
- Multi-platform build/push via Buildx
- Slack notification on workflow failure

## Upgrading Base Versions (Workflow-Only)

To upgrade image versions, update the matrix in `.github/workflows/build-images.yml` instead of editing Dockerfiles.

The workflow matrix controls:
- `image_name`: output repository suffix (for example `eclipse-temurin`, `distroless-node`, `python`)
- `context`: Docker build context directory
- `dockerfile`: Dockerfile path
- `tag_prefix`: raw variant tag and prefix for dynamic tags
- `publish_latest`: whether to publish `latest` for that matrix entry

Example matrix entry:

```yaml
- image_name: eclipse-temurin
  context: images/java/eclipse-temurin
  dockerfile: images/java/eclipse-temurin/Dockerfile.java25
  tag_prefix: 25-jre-jammy
  publish_latest: true
```

How updates work:
- Existing tag refresh: keep the same `tag_prefix`; scheduled rebuilds (`cron`) run with `pull: true`, so the latest upstream base layers are pulled automatically.
- New tag adoption: update `dockerfile` (and/or its `FROM` image tag), then keep or change `tag_prefix` to the published tag you want.
- New variant publish: add a new matrix row with `image_name`, `context`, `dockerfile`, `tag_prefix`, and `publish_latest`.

When moving to a new tag, verify:
- The upstream tag in the Dockerfile `FROM` exists and is supported for your target architecture (`linux/amd64`, `linux/arm64`).
- The selected `context`/`dockerfile` paths match repository layout.
- Consumers pin to the explicit variant tag (for example `25-jre-jammy`) rather than relying on `latest`.

## Security Upgrades

All Dockerfiles use a multi-stage build pattern to ensure OS security patches are always applied fresh:

```dockerfile
FROM base-image AS base
# ... setup steps ...

FROM base AS security-upgrades
RUN apk upgrade --no-cache  # or apt-get upgrade for Ubuntu
```

The CI workflow uses BuildKit's `--no-cache-filter=security-upgrades` to skip the cache for this stage, ensuring `apk upgrade` / `apt-get upgrade` always fetches the latest patches — even when other layers are cached.

Distroless images use prep/runtime stages and do not include a `security-upgrades` stage.
