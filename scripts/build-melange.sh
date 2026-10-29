#!/usr/bin/env bash
set -euo pipefail

: "${RUNNER_TEMP:?}" "${GITHUB_WORKSPACE:?}" "${MELANGE_CONFIG:?}"
mkdir -p "$RUNNER_TEMP/scanner-keys" "$RUNNER_TEMP/scanner-source" \
  "$RUNNER_TEMP/scanner-packages" "$RUNNER_TEMP/scanner-cache/apk"
docker run --rm \
  --volume "$RUNNER_TEMP/scanner-keys:/keys" \
  cgr.dev/chainguard/melange@sha256:7939f64319d3e6de871fbb58c0c8d0e1966951a254c4b4f91286147ce79b19a4 \
  keygen /keys/melange.rsa
for arch in ${MELANGE_ARCHES:-x86_64 aarch64}; do
  bash scripts/quiet-build.sh "$RUNNER_TEMP/build-logs/melange-$arch.log" \
    docker run --rm --privileged \
    --volume "$GITHUB_WORKSPACE:/work:ro" \
    --volume "$RUNNER_TEMP/scanner-keys:/keys:ro" \
    --volume "$RUNNER_TEMP/scanner-source:/source:ro" \
    --volume "$RUNNER_TEMP/scanner-packages:/packages" \
    --volume "$RUNNER_TEMP/scanner-cache:/cache" \
    --workdir /work \
    cgr.dev/chainguard/melange@sha256:7939f64319d3e6de871fbb58c0c8d0e1966951a254c4b4f91286147ce79b19a4 \
    build --arch "$arch" \
    --cache-dir /cache \
    --apk-cache-dir /cache/apk \
    --source-dir /source \
    --signing-key /keys/melange.rsa \
    --out-dir /packages \
    "$MELANGE_CONFIG"
done
