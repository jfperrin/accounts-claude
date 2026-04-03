#!/usr/bin/env bash
set -euo pipefail

REMOTE_USER="ubuntu"
REMOTE_HOST="perrin.at"
REMOTE="${REMOTE_USER}@${REMOTE_HOST}"
REMOTE_DIR="/opt/accounts-claude"

echo "→ Vérification de la connexion SSH..."
ssh -o ConnectTimeout=10 "${REMOTE}" "echo OK" > /dev/null

echo "→ Sync sources → ${REMOTE}:${REMOTE_DIR}"
rsync -az --delete \
  --exclude='.git' \
  --exclude='node_modules' \
  --exclude='*/node_modules' \
  --exclude='client/dist' \
  --exclude='*.log' \
  --exclude='server/.env' \
  ./ "${REMOTE}:${REMOTE_DIR}/"

echo "→ Copie .env (premier déploiement uniquement)"
if ! ssh "${REMOTE}" "test -f ${REMOTE_DIR}/server/.env"; then
  scp server/.env "${REMOTE}:${REMOTE_DIR}/server/.env"
  echo "  .env copié — pense à mettre CORS_ORIGIN=http://${REMOTE_HOST} sur le serveur"
fi

echo "→ Build & deploy"
ssh "${REMOTE}" "
  set -e
  cd ${REMOTE_DIR}
  docker compose build
  docker compose up -d --remove-orphans
  docker compose ps
"

echo ""
echo "✓ Déployé → http://${REMOTE_HOST}"
