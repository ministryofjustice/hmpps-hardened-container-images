#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -lt 2 ]; then
  echo "Usage: quiet-build.sh <log-file> <command> [args...]" >&2
  exit 2
fi
log=$1
shift
mkdir -p "$(dirname "$log")"
echo "Starting build; full output: $log"
if "$@" >"$log" 2>&1; then
  echo "Build completed; full output: $log"
else
  status=$?
  echo "Build failed (exit $status). Last 200 log lines:" >&2
  tail -n 200 "$log" >&2
  exit "$status"
fi
