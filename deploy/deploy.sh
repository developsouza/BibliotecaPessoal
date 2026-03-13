#!/bin/bash
# =============================================================
# deploy.sh — BookLibrary — Ubuntu 22.04
# Executar no servidor: bash deploy.sh
# =============================================================

set -e  # Aborta ao primeiro erro

APP_DIR="/var/www/booklibrary"
REPO_URL="https://github.com/developsouza/BibliotecaPessoal.git"
BRANCH="main"

echo "========================================"
echo " BookLibrary — Deploy $(date '+%Y-%m-%d %H:%M:%S')"
echo "========================================"

# ── 1. Atualizar código ──────────────────────────────────────
if [ -d "$APP_DIR/.git" ]; then
    echo "[1/6] Atualizando código via git pull..."
    cd "$APP_DIR"
    git fetch origin
    git reset --hard "origin/$BRANCH"
else
    echo "[1/6] Clonando repositório pela primeira vez..."
    git clone --branch "$BRANCH" "$REPO_URL" "$APP_DIR"
    cd "$APP_DIR"
fi

# ── 2. Backend — dependências ────────────────────────────────
echo "[2/6] Instalando dependências do backend..."
cd "$APP_DIR/backend"
npm ci --omit=dev

# ── 3. Verificar .env do backend ────────────────────────────
if [ ! -f "$APP_DIR/backend/.env" ]; then
    echo ""
    echo "⚠️  ATENÇÃO: $APP_DIR/backend/.env não encontrado."
    echo "   Copie .env.example e preencha as variáveis:"
    echo "   cp $APP_DIR/backend/.env.example $APP_DIR/backend/.env"
    echo ""
    exit 1
fi

# ── 4. Frontend — build de produção ─────────────────────────
echo "[4/6] Construindo o frontend..."
cd "$APP_DIR/frontend"
npm ci

# Verificar .env.production do frontend
if [ ! -f "$APP_DIR/frontend/.env.production" ]; then
    echo ""
    echo "⚠️  ATENÇÃO: $APP_DIR/frontend/.env.production não encontrado."
    echo "   Copie .env.example e ajuste a URL da API:"
    echo "   cp $APP_DIR/frontend/.env.example $APP_DIR/frontend/.env.production"
    echo ""
    exit 1
fi

npm run build

# ── 5. Garantir pastas necessárias ──────────────────────────
echo "[5/6] Garantindo pastas de dados e uploads..."
mkdir -p "$APP_DIR/backend/data"
mkdir -p "$APP_DIR/backend/uploads/covers"
# Ajustar permissões para o usuário www-data (Nginx)
chown -R www-data:www-data "$APP_DIR/backend/data" "$APP_DIR/backend/uploads" 2>/dev/null || true

# ── 6. PM2 — reiniciar / iniciar ────────────────────────────
echo "[6/6] Reiniciando a API com PM2..."
cd "$APP_DIR"

if pm2 describe booklibrary-api > /dev/null 2>&1; then
    pm2 reload ecosystem.config.js --update-env
else
    pm2 start ecosystem.config.js
    pm2 save
fi

# ── Nginx ───────────────────────────────────────────────────
echo "Testando configuração do Nginx..."
nginx -t && systemctl reload nginx

echo ""
echo "✅ Deploy concluído com sucesso!"
echo "   API:      http://localhost:3002/api/health"
echo "   Site:     https://biblioteca.g3tsistemas.com.br"
echo ""
