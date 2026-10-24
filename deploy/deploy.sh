#!/usr/bin/env bash
# deploy/deploy.sh — run from the repo root on the dev machine.
# Connection settings come from the environment or from a git-ignored deploy/deploy.env
# (copy deploy/deploy.env.example). Nothing about the server is stored in the repository.
set -euo pipefail

[ -f deploy/deploy.env ] && . deploy/deploy.env
: "${DEPLOY_HOST:?Set DEPLOY_HOST (e.g. ubuntu@your-server) in deploy/deploy.env}"
: "${DEPLOY_SSH_KEY:?Set DEPLOY_SSH_KEY (path to your private key) in deploy/deploy.env}"
REMOTE_DIR="${DEPLOY_DIR:-/home/ubuntu/planning-repas}"
SSH_KEY="$DEPLOY_SSH_KEY"
HOST="$DEPLOY_HOST"

echo "Transfert du code versionné (git-tracked uniquement)..."
git archive --format=tar HEAD | ssh -i "$SSH_KEY" "$HOST" "mkdir -p $REMOTE_DIR && cd $REMOTE_DIR && rm -rf src scripts deploy docs public && tar -x -C $REMOTE_DIR"

echo "Transfert de .env.local -> .env (non versionné)..."
scp -i "$SSH_KEY" .env.local "$HOST:$REMOTE_DIR/.env"

echo "Restriction des permissions de .env (lisible uniquement par l'utilisateur du service)..."
ssh -i "$SSH_KEY" "$HOST" "chmod 600 $REMOTE_DIR/.env"

echo "Installation des dépendances et build sur le serveur..."
ssh -i "$SSH_KEY" "$HOST" "cd $REMOTE_DIR && npm ci && npm run build"

echo "Installation du service systemd..."
scp -i "$SSH_KEY" deploy/planning-repas.service "$HOST:/tmp/planning-repas.service"
ssh -i "$SSH_KEY" "$HOST" "sudo mv /tmp/planning-repas.service /etc/systemd/system/planning-repas.service && sudo systemctl daemon-reload && sudo systemctl enable --now planning-repas && sudo systemctl restart planning-repas"

echo "Vérification..."
ssh -i "$SSH_KEY" "$HOST" "sleep 2 && curl -s http://localhost:3100 | grep -o 'Planning Repas' && echo OK"
