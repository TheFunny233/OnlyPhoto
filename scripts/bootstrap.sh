#!/usr/bin/env bash
# PhotoMaster bootstrap (macOS / Linux).
# NOTE: This platform variant is provided for parity but was NOT executed on the Windows
# development host. The Windows script (bootstrap.ps1) is the tested entry point.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

TOOLS="$ROOT/.tools"
NODE_DIR="$TOOLS/node"
NPM_GLOBAL="$TOOLS/npm-global"
mkdir -p "$TOOLS" "$NPM_GLOBAL"

echo "[bootstrap] root: $ROOT"

if [ ! -x "$NODE_DIR/bin/node" ]; then
  echo "[bootstrap] downloading official Node.js LTS ..."
  OS="$(uname -s | tr '[:upper:]' '[:lower:]')"
  ARCH="$(uname -m)"
  case "$ARCH" in
    x86_64) ARCH=x64 ;;
    aarch64|arm64) ARCH=arm64 ;;
  esac
  OS_TAG="$OS"
  [ "$OS" = "darwin" ] && OS_TAG="darwin"
  VERSION="$(curl -fsSL https://nodejs.org/dist/index.json | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s);console.log(j.find(x=>x.lts)!==undefined?j.find(x=>x.lts).version:j[0].version)})' 2>/dev/null || echo v22.11.0)"
  TARBALL="node-${VERSION}-${OS_TAG}-${ARCH}.tar.gz"
  curl -fsSL "https://nodejs.org/dist/${VERSION}/${TARBALL}" -o "$TOOLS/$TARBALL"
  tar -xzf "$TOOLS/$TARBALL" -C "$TOOLS"
  rm -rf "$NODE_DIR"
  mv "$TOOLS/node-${VERSION}-${OS_TAG}-${ARCH}" "$NODE_DIR"
fi
export PATH="$NODE_DIR/bin:$NPM_GLOBAL/bin:$PATH"
export npm_config_prefix="$NPM_GLOBAL"
echo "[bootstrap] node $(node --version)"

if [ ! -x "$NPM_GLOBAL/bin/pnpm" ]; then
  echo "[bootstrap] installing pnpm (project-local) ..."
  npm install -g pnpm@latest --no-audit --no-fund
fi

if [ ! -f "$ROOT/.env.local" ]; then
  cp "$ROOT/.env.example" "$ROOT/.env.local"
  echo "[bootstrap] created .env.local from .env.example"
fi
if ! grep -qE '^SESSION_SECRET=.+' "$ROOT/.env.local"; then
  SECRET="$(node -e 'console.log(require("crypto").randomBytes(48).toString("base64url"))')"
  printf '\nSESSION_SECRET=%s\n' "$SECRET" >> "$ROOT/.env.local"
  echo "[bootstrap] generated SESSION_SECRET (not printed)"
fi

pnpm install
pnpm exec playwright install chromium
pnpm exec tsx scripts/migrate.ts
pnpm exec tsx scripts/seed.ts
pnpm exec tsx scripts/doctor.ts
echo "[bootstrap] done. Start with: pnpm dev  or  pnpm start"