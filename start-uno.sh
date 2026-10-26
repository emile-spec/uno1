#!/bin/sh
set -eu
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1; then
  echo 'Installer Node.js 22 eller nyere fra https://nodejs.org og start igen.'
  exit 1
fi
exec node server.js
