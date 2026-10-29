# Node.js Base Image

Lean, standardized Node.js base for HMPPS apps across Alpine and distroless variants.

## Variants

| Image | Tag | Description |
|-------|-----|-------------|
| `hmpps-node` | `24-alpine` | Full Node.js 24 Alpine image including npm, yarn, and corepack |
| `hmpps-node` | `24-alpine-runtime` | Runtime-only image with package managers removed for production |
| `hmpps-distroless-node` | `24` | Distroless runtime image with Node.js only — minimal attack surface (no shell/package manager) |

## Distroless Variant

The distroless variant uses Google's minimal distroless base image, reducing attack surface and image size.

**Notes:**

- No shell/package manager in runtime image (debugging harder).
- Two-stage build: prepare assets in full Node image, run on distroless.
- Requires explicit binary/library copies; fewer implicit dependencies.

## Features

- Node.js 24 variants for Alpine and distroless runtimes
- Non‑root user `appuser` (UID/GID 2000) and `WORKDIR /app`
- Timezone: `Europe/London`
- The Alpine runtime-only variant is assembled declaratively with apko from Alpine 3.24 packages
- Dockerfile-built Alpine variants apply `apk upgrade --no-cache`; the apko runtime declares its packages and versions
- OCI labels: `hmpps.node.base_image`, `hmpps.node.base_variant`, `org.opencontainers.image.base.name`

## Building the Alpine Runtime Image

CI builds the Dockerfile runtime as
`ghcr.io/ministryofjustice/hmpps-hardened-alpine-node-runtime-24` and publishes
the apko variant separately as
`ghcr.io/ministryofjustice/hmpps-hardened-alpine-node-runtime-24-apko`.
Both use the workflow's branch or release tag and run through Snyk scanning.
Release-tag builds include AMD64 and ARM64; other builds use AMD64.

Install the native apko CLI and ensure Docker is available:

```sh
brew install apko
```

Then, from the repository root, assemble the image from prebuilt Alpine packages:

```sh
mkdir -p /tmp/hmpps-node-output && \

apko build \
  --arch arm64 \
  --sbom-path /tmp/hmpps-node-output \
  images/node/alpine-runtime/apko.yaml \
  hmpps-node-runtime:local \
  /tmp/hmpps-node-output/hmpps-node-runtime.tar && \

docker load --input /tmp/hmpps-node-output/hmpps-node-runtime.tar && \
docker run --rm hmpps-node-runtime:local-arm64 --version
```

Apko runs directly on your machine without a Docker build runner. Docker is only
needed to load and run the resulting image. No compilation, Melange, or local
package-signing keys are required.

The apko runtime currently runs as root; the `appuser` account (UID/GID 2000)
is available for applications to select explicitly.
The apko accounts configuration uses numeric `run-as: 0`, so Docker runs as root
without requiring a named root account or `alpine-baselayout-data`. Apko rejects
explicit UID-0 user definitions. Use `--user 0:0`, not `--user root`, when
overriding the user on this image.

The `nodejs~24` constraint selects available Node.js 24 packages from Alpine
3.24 without allowing an upgrade to Node 25 or later. npm, npx, Corepack, and
Yarn are not requested. This is Alpine's Node build rather than the binary
distributed in the official Docker Node image; validate application and native
module compatibility and scan the resulting image before production use.
Alpine's `apk` package manager is included via `apk-tools` for installing system
packages. With the default Node entrypoint, invoke it using
`docker run --rm --entrypoint /sbin/apk hmpps-node-runtime:local-arm64 --version`.

Go is pinned to `1.27.2-r0` from Alpine edge/community because Alpine 3.24 does
not provide this version. The edge repository is untagged to keep the generated
APK world compatible with `apk`; it can also supply other packages and dependencies.
Mixing stable and edge is not supported by Alpine. Validate application
compatibility and scan the image before production use. Edge is rolling, so
removal of the pinned version will require a pin update or an archived package source.
`GOTOOLCHAIN=local` prevents Go from
automatically downloading a different toolchain. Check the installed version with
`docker run --rm --entrypoint go hmpps-node-runtime:local-arm64 version`.

The apko config uses Alpine 3.24 repositories alongside edge/community and pins
the `ca-certificates` and `libstdc++` package versions. It also installs the MOJ Production Root CA into the system
trust bundle; its PEM is embedded in the apko config from the
[MOJ devcontainer source](https://raw.githubusercontent.com/ministryofjustice/.devcontainer/refs/heads/main/images/base/src/usr/local/share/ca-certificates/moj-root.crt).
Use `--arch x86_64` on Intel or `--arch arm64` on ARM64. For both platforms use
`--arch x86_64,arm64`. Loaded archive tags have architecture suffixes (`-amd64`
or `-arm64`). To publish directly,
replace `apko build` with `apko publish`, provide a registry image tag, and
authenticate to that registry first.

Registries:

- `ghcr.io/ministryofjustice/hmpps-node`
- `ghcr.io/ministryofjustice/hmpps-distroless-node`

Common tags:

- `hmpps-node`: `24-alpine`, `24-alpine-runtime`, date tags (YYYYMMDD), `latest`
- `hmpps-distroless-node`: `24`, date tags (YYYYMMDD), `latest`

Current latest mappings in CI:

- `ghcr.io/ministryofjustice/hmpps-node:latest` -> `24-alpine-runtime`
- `ghcr.io/ministryofjustice/hmpps-distroless-node:latest` -> `24`

## Usage (simple)

```dockerfile
FROM ghcr.io/ministryofjustice/hmpps-node:24-alpine
WORKDIR /app
COPY --chown=appuser:appgroup package*.json ./
RUN npm ci --omit=dev --no-audit
COPY --chown=appuser:appgroup . .
ENV NODE_ENV=production
USER 2000
CMD ["npm", "start"]
```

## Notes

- Add build tools (git, curl, etc.) in your app image only if needed.
- To switch Node version, pick the matching published tag.
- Use `24-alpine-runtime` for the final stage of multi-stage builds — npm/yarn are not needed at runtime and their removal reduces the attack surface.

## Usage (multi-stage)

```dockerfile
# Build args available to all stages
ARG BUILD_NUMBER
ARG GIT_REF
ARG GIT_BRANCH

# Stage: build assets
FROM ghcr.io/ministryofjustice/hmpps-node:24-alpine AS build

ARG BUILD_NUMBER
ARG GIT_REF
ARG GIT_BRANCH

# Cache breaking and ensure required build / git args defined
RUN test -n "$BUILD_NUMBER" || (echo "BUILD_NUMBER not set" && false)
RUN test -n "$GIT_REF" || (echo "GIT_REF not set" && false)
RUN test -n "$GIT_BRANCH" || (echo "GIT_BRANCH not set" && false)

WORKDIR /app

COPY package*.json .allowed-scripts.mjs .npmrc ./
RUN NPM_CONFIG_AUDIT=false NPM_CONFIG_FUND=false npm run setup
ENV NODE_ENV='production'

COPY . .
RUN npm run build

RUN npm prune --no-audit --no-fund --omit=dev

# Stage: copy production assets and dependencies
FROM ghcr.io/ministryofjustice/hmpps-node:24-alpine-runtime

ARG BUILD_NUMBER
ARG GIT_REF
ARG GIT_BRANCH

COPY --from=build --chown=appuser:appgroup \
        /app/package.json \
        /app/package-lock.json \
        ./

COPY --from=build --chown=appuser:appgroup \
        /app/dist ./dist

COPY --from=build --chown=appuser:appgroup \
        /app/node_modules ./node_modules

EXPOSE 3000
ENV BUILD_NUMBER=${BUILD_NUMBER}
ENV GIT_REF=${GIT_REF}
ENV GIT_BRANCH=${GIT_BRANCH}
ENV NODE_ENV='production'
USER 2000

CMD [ "node", "dist/server.js" ]
```
