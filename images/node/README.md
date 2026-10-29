# Node.js Base Image

Lean, standardized Node.js base for HMPPS apps across Alpine and distroless variants.

## Variants

| Image | Tag | Description |
|-------|-----|-------------|
| `node-alpine` | `24-npm11-docker-main` | Node.js 24 build image with npm 11 and apk |
| `node-alpine-runtime` | `24-apko-main` | Runtime-only image without package managers |
| `node-distroless` | `24-docker-main` | Distroless runtime image with Node.js only — minimal attack surface (no shell/package manager) |

## Distroless Variant

The distroless variant uses Google's minimal distroless base image, reducing attack surface and image size.

**Notes:**

- No shell/package manager in runtime image (debugging harder).
- Two-stage build: prepare assets in full Node image, run on distroless.
- Requires explicit binary/library copies; fewer implicit dependencies.

## Features

- Node.js 24 and 26 Alpine build/runtime flavours; Node.js 24 distroless runtime
- Non‑root user `appuser` (UID/GID 2000) and `WORKDIR /app`
- Timezone: `Europe/London`
- The Alpine runtime-only variant is assembled declaratively with apko from Alpine 3.24 packages
- Dockerfile-built Alpine variants apply `apk upgrade --no-cache`; the apko runtime declares its packages and versions
- OCI labels: `hmpps.node.base_image`, `hmpps.node.base_variant`, `org.opencontainers.image.base.name`

## Alpine build and runtime flavours

All references below have the prefix
`ghcr.io/ministryofjustice/hmpps-hardened-container-images/`.
Append `-main`, a sanitized branch name, or a release such as `-v1.2.3` to each
flavour tag. Build methods have separate tags in the same type repository.
Old flavour-specific package names are no longer published; no `latest` alias
is produced.

| Flavour | apko/Melange image suffix | Docker comparison image suffix | Package managers in apko image |
|---------|--------------------------|--------------------------------|-------------------------------|
| Node 24, npm 11.12.1 | `node-alpine:24-npm11-apko` | `node-alpine:24-npm11-docker` | npm, npx, apk |
| Node 24, npm 12.2.0 | `node-alpine:24-npm12-apko` | `node-alpine:24-npm12-docker` | npm, npx, apk |
| Node 26, npm 12.2.0 | `node-alpine:26-npm12-apko` | `node-alpine:26-npm12-docker` | npm, npx, apk |
| Node 24 runtime | `node-alpine-runtime:24-apko` | `node-alpine-runtime:24-docker` | none |

Node 26 runtime recipes are available locally but both publishing entries are
currently disabled; this refactor does not re-enable them.

There is deliberately no Node 26/npm 11 flavour. The existing Docker Node 24
runtime is unchanged; the comparison reports its actual package managers rather
than assuming parity. The new Docker Node 26 baseline removes Node package
managers but retains apk. The separately published scanner flavour retains apk.
**The Node 24 apko runtime now excludes apk**, unlike earlier versions of that
image. Use a build flavour when installing packages.

[render-node-apko.rb](../../scripts/render-node-apko.rb) derives build/runtime
configs from [apko.yaml](alpine-runtime/apko.yaml), retaining the MOJ CA,
timezone, Node entrypoint and UID/GID 2000 accounts. Rendered flavours use only
Alpine 3.24 main/community, with `nodejs~24` or `nodejs-current~26`.
These are precompiled Alpine Node packages, not locally compiled Node binaries.
Melange packages the checksum-pinned npm registry distributions as signed APKs;
npm itself is JavaScript and is not compiled with Go.

Build images include apk and the selected npm/npx, with `NODE_ENV=development`.
Runtime images use `NODE_ENV=production` and exclude apk-tools and all Node
package managers rather than installing and subsequently deleting them.
They retain a shell, CA certificates and timezone data; they are not distroless.
Go and native compilers are not installed in either flavour.

### Local builds

Install Ruby, apko and Melange, and start Docker. From the repository root:

```sh
make node-flavour NODE_MAJOR=24 NPM_MAJOR=11 FLAVOUR=build
make node-flavour NODE_MAJOR=24 NPM_MAJOR=12 FLAVOUR=build
make node-flavour NODE_MAJOR=26 NPM_MAJOR=12 FLAVOUR=build
make node-flavour NODE_MAJOR=24 FLAVOUR=runtime
make node-flavour NODE_MAJOR=26 FLAVOUR=runtime
```

`ARCH` defaults to the host architecture; specify `ARCH=amd64` or `ARCH=arm64`
to override. Docker image tags are, for example,
`hmpps-node-24-build-npm11:local-arm64` and `hmpps-node-26-runtime:local-arm64`.
Outputs default to `/tmp/hmpps-node-flavours`. The build target reuses signed
APK output and caches under `SCANNER_BUILD_DIR` (default `/tmp/hmpps-scanners`).
Set `SCANNER_CA_CERTIFICATE=/absolute/path/to/moj-root.crt` when guest downloads
need MOJ TLS inspection trust; see the CA download command below. No Melange
build or signing key is needed for runtime-only images.

For manual runtime assembly:

```sh
mkdir -p /tmp/hmpps-node-output
ruby scripts/render-node-apko.rb 26 runtime /tmp/hmpps-node-output/apko.yaml
apko build --arch arm64 --sbom-path /tmp/hmpps-node-output \
  /tmp/hmpps-node-output/apko.yaml hmpps-node-runtime:local \
  /tmp/hmpps-node-output/image.tar
docker load --input /tmp/hmpps-node-output/image.tar
docker run --rm hmpps-node-runtime:local-arm64 --version
```

The shared template still contains apk for scanner compatibility; **render a
runtime config first** instead of building that template directly for production.
The images run as numeric UID 0 by default; `appuser` is available via
`--user 2000:2000`. Use `--user 0:0`, not `--user root`, when overriding root.

### CI comparisons

The workflow builds the four enabled pairs and compares same-run AMD64 images in the
**Compare Docker and apko/Melange Node images** job. Its job summary and
`node-image-comparison` artifact include:

- Snyk critical/high/medium/low finding counts, including application dependencies.
- Local Docker-reported image size (`docker image inspect`'s `Size`), in MiB.
- Build-stage elapsed seconds, including cache restoration, assembly and publishing,
  excluding scanning.
- Actual Node/npm versions and presence of apk, npm, npx, yarn, yarnpkg,
  corepack and pnpm.

Failed or skipped scans are **N/A**, not zero vulnerabilities. Missing builds
appear explicitly. Counts are findings, not deduplicated CVEs. Dependency versions,
base-image packaging, cache warmth and retained Docker package managers can differ;
the comparison does not imply feature parity or guaranteed vulnerability reduction.
Both backends build/publish AMD64 and ARM64 for comparison flavours on every
run. Comparisons always inspect AMD64, probing versions/package managers as
numeric UID 0 independently of the configured default container user.
No extra scan service is introduced: both
backends use the existing pinned shared Snyk action, at threshold `low`.

Run configuration/report/tagging tests with
`node --test tests/node-flavours.test.cjs tests/image-reference.test.cjs`.

### Scanner runtime flavour

CI also publishes
`ghcr.io/ministryofjustice/hmpps-hardened-container-images/node-alpine-runtime:24-scanners-apko-main`.
It uses the same apko configuration plus the signed `hmpps-node-scanners` APK:

| Tool | Version | Build toolchain |
|------|---------|-----------------|
| Scorecard | 5.6.0 | Alpine `go=1.27.2-r0` |
| Conftest | 0.71.1 | Alpine `go=1.27.2-r0` |
| Betterleaks | 1.9.0 | Alpine `go=1.27.2-r0` |
| Hadolint | 2.15.1 | SHA-256-verified upstream static binary (Haskell, not Go) |
| Snyk CLI (public build) | 1.1308.0-oss | Alpine `go=1.27.2-r0`, with the legacy Node/TypeScript CLI built from source |

Snyk uses upstream `BUILD_MODE=public`, including its required `-oss` version
suffix, license collection and embedded legacy CLI. The Go executable is verified
as Go 1.27.2; this is not a guarantee about every embedded or dynamically downloaded
component. The legacy CLI bundles a pkg-provided Node runtime, not a Go-compiled
runtime. Private Snyk features are not included, and IaC testing needs the upstream
`IAC_RULES_URL` configuration, which this recipe does not supply. This build is not
feature-equivalent to Snyk's official distribution.
When running Snyk as `appuser`, set `HOME` to a writable directory and create
it before invoking Snyk (for example `HOME=/tmp/snyk-home` and
`mkdir -p "$HOME"`). The base image intentionally uses `/dev/null` as
`appuser`'s account home; Snyk's legacy config store requires a real directory.

Snyk's build uses Node 24, pinned npm 11.12.1 and upstream Make targets.
Its license tooling uses proxy-first Go downloads with direct fallback to avoid
cloning entire histories of older dependencies. npm and pkg downloads are cached
alongside Go dependencies under `/var/cache/melange`.

Melange compiles static binaries with `CGO_ENABLED=0` and
`GOTOOLCHAIN=local`, verifying the embedded Go compiler version. Source archives
are pinned by SHA-256; Go dependencies are downloaded directly from source repositories
and verified against the source's module checksums and Go's checksum database
(except Snyk's proxy-first build described above).
`GOPROXY=direct` bypasses the module proxy, whose ZIP downloads repeatedly stall
or truncate in the local network environment. Proxy-first fallback still waits
for a stalled transfer to fail before trying the source repository.
Source downloads still undergo Go checksum
verification; Git is installed only in the build guest. Final download or
checksum failures still stop the build.
Only the scanner binaries and Snyk license enter the runtime APK: Go, GCC and npm are not
added. The image retains the Node entrypoint, MOJ CA, timezone and accounts.
Override the entrypoint to run a scanner, for example:

```sh
docker run --rm --entrypoint conftest \
  ghcr.io/ministryofjustice/hmpps-hardened-container-images/node-alpine-runtime:24-scanners-apko-main \
  --version
```

For a native ARM64 local build, install `melange` and `apko`, ensure Docker is
running, then run from the repository root:

```sh
mkdir -p /tmp/hmpps-scanners/keys /tmp/hmpps-scanners/source /tmp/hmpps-scanners/output /tmp/hmpps-scanners/cache
curl --fail --show-error --location \
  https://raw.githubusercontent.com/ministryofjustice/.devcontainer/refs/heads/main/images/base/src/usr/local/share/ca-certificates/moj-root.crt \
  --output /tmp/hmpps-scanners/moj-root.crt
melange keygen /tmp/hmpps-scanners/keys/melange.rsa
melange build \
  --runner docker --arch aarch64 \
  --ca-certificate-append /tmp/hmpps-scanners/moj-root.crt \
  --cache-dir /tmp/hmpps-scanners/cache \
  --apk-cache-dir /tmp/hmpps-scanners/apk-cache \
  --source-dir /tmp/hmpps-scanners/source \
  --signing-key /tmp/hmpps-scanners/keys/melange.rsa \
  --out-dir /tmp/hmpps-scanners/packages \
  images/node/alpine-runtime/melange.scanners.yaml
apko build \
  --arch arm64 \
  --build-repository-append /tmp/hmpps-scanners/packages \
  --keyring-append /tmp/hmpps-scanners/keys/melange.rsa.pub \
  --package-append hmpps-node-scanners=1.0.0-r3 \
  --sbom-path /tmp/hmpps-scanners/output \
  images/node/alpine-runtime/apko.yaml \
  hmpps-node-scanners:local \
  /tmp/hmpps-scanners/output/image.tar
docker load --input /tmp/hmpps-scanners/output/image.tar
docker run --rm --entrypoint scorecard hmpps-node-scanners:local-arm64 version
docker run --rm --entrypoint conftest hmpps-node-scanners:local-arm64 --version
docker run --rm --entrypoint betterleaks hmpps-node-scanners:local-arm64 version
docker run --rm --entrypoint hadolint hmpps-node-scanners:local-arm64 --version
docker run --rm --entrypoint snyk hmpps-node-scanners:local-arm64 --version
```

The commands above append the MOJ root CA to the build guest's trust bundle.
This covers source and Go module downloads through MOJ TLS inspection;
final-image CA configuration does not configure the build guest.
If the Melange CLI itself cannot download Alpine repository indexes or packages,
also configure its process trust with
`SSL_CERT_FILE=/tmp/hmpps-scanners/moj-root.crt melange build ...` on macOS, where
Go also retains system roots. Do not disable certificate verification.
Use `--arch x86_64` for both tools on AMD64.
Keep signing keys secure and reuse the APK repository for image-only changes.
For subsequent local package builds, the Make target creates the cache
directories before invoking Melange and reuses the signing key:

```sh
make scanners ARCH=arm64 \
  SCANNER_CA_CERTIFICATE=/tmp/hmpps-scanners/moj-root.crt
```

`SCANNER_BUILD_DIR` defaults to `/tmp/hmpps-scanners`; set it to an absolute
directory on persistent storage to survive temporary-directory cleanup.
The Makefile defaults `ARCH` to the local host architecture to avoid emulating
AMD64 on ARM64 Macs. Omit `ARCH` for native builds; use `ARCH=amd64` only when
you need an AMD64 output. Caches are architecture-specific, so the first native
build after an emulated build may still compile dependencies.
The host `cache` directory must exist before Melange starts; otherwise Melange
can skip its mount and silently use an ephemeral guest cache.
Keep the cache directory between builds: it holds source archives, Go modules
and compiled Go packages. `--apk-cache-dir` separately retains Alpine package
downloads for the build environment. CI restores and saves these caches with
`actions/cache`, including after failed compilation so completed downloads and
compilation work are retained. Go separates cached outputs by their build inputs and target
architecture. The first build still downloads and compiles dependencies; later
builds can reuse that work. Do not start duplicate builds to accelerate an
existing build or delete its cache while it is running.
Melange still assembles and signs an APK on every invocation; Go reuses unchanged
compiled dependencies rather than recompiling them. Skip Melange and rerun only
apko when reusing an existing signed scanner APK for image-only changes.
The scanner build sets `GODEBUG=http2client=0` to avoid HTTP/2 stream resets
seen during module downloads through the local proxy; truncated downloads also
are avoided by bypassing the module proxy as described above. TLS certificate and Go
module checksum verification remain enabled.
When updating scanner versions in the recipe (including source checksums and linker version metadata),
bump its package epoch and update the APK pin in CI and these commands. The
exact Go pin must remain available in edge/community or builds will fail.

Registries:

- `ghcr.io/ministryofjustice/hmpps-hardened-container-images/node-alpine`
- `ghcr.io/ministryofjustice/hmpps-hardened-container-images/node-alpine-runtime`
- `ghcr.io/ministryofjustice/hmpps-hardened-container-images/node-distroless`

Common tags:

- `node-alpine`: `24-npm11-apko-main`, `24-npm12-docker-main`, `26-npm12-apko-main`
- `node-alpine-runtime`: `24-apko-main`, `24-docker-main`, `24-scanners-apko-main`
- `node-distroless`: `24-docker-main`

Replace `main` with a sanitized branch or release tag. CI does not publish
`latest`, bare version, date or SHA aliases. Pin release tags and digests for production.

## Usage (simple)

```dockerfile
FROM ghcr.io/ministryofjustice/hmpps-hardened-container-images/node-alpine:24-npm11-apko-main
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
- Use `node-alpine-runtime:24-apko-main` for the final stage of multi-stage builds — npm/yarn are not needed at runtime and their removal reduces the attack surface.

## Usage (multi-stage)

```dockerfile
# Build args available to all stages
ARG BUILD_NUMBER
ARG GIT_REF
ARG GIT_BRANCH

# Stage: build assets
FROM ghcr.io/ministryofjustice/hmpps-hardened-container-images/node-alpine:24-npm11-apko-main AS build

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
FROM ghcr.io/ministryofjustice/hmpps-hardened-container-images/node-alpine-runtime:24-apko-main

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
