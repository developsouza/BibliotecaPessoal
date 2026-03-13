# BookLibrary — Guia de Deploy no Ubuntu 22.04

## Pré-requisitos no servidor (instalar uma única vez)

```bash
# Atualizar pacotes
sudo apt update && sudo apt upgrade -y

# Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# PM2 (gerenciador de processos Node)
sudo npm install -g pm2
pm2 startup systemd -u $USER --hp $HOME   # habilita auto-start no boot

# Nginx
sudo apt install -y nginx

# Certbot (SSL gratuito via Let's Encrypt)
sudo apt install -y certbot python3-certbot-nginx

# Criar pasta da aplicação
sudo mkdir -p /var/www/booklibrary
sudo chown -R $USER:$USER /var/www/booklibrary
```

---

## 1. Subir o código para o servidor

### Opção A — via Git (recomendado)

```bash
# No servidor
git clone https://github.com/SEU_USUARIO/SEU_REPO.git /var/www/booklibrary
```

### Opção B — via rsync (sem Git)

```bash
# No Windows (PowerShell / WSL), enviar os arquivos por rsync ou SCP:
scp -r ./backend  usuario@ip-do-servidor:/var/www/booklibrary/
scp -r ./frontend usuario@ip-do-servidor:/var/www/booklibrary/
scp ecosystem.config.js usuario@ip-do-servidor:/var/www/booklibrary/
```

---

## 2. Configurar variáveis de ambiente

```bash
# Backend
cp /var/www/booklibrary/backend/.env.example /var/www/booklibrary/backend/.env
nano /var/www/booklibrary/backend/.env   # preencher todos os valores

# Frontend
cp /var/www/booklibrary/frontend/.env.example /var/www/booklibrary/frontend/.env.production
nano /var/www/booklibrary/frontend/.env.production
# Alterar: VITE_API_URL=https://biblioteca.g3tsistemas.com.br/api
```

---

## 3. Instalar dependências e fazer build

```bash
# Backend
cd /var/www/booklibrary/backend
npm ci --omit=dev

# Frontend
cd /var/www/booklibrary/frontend
npm ci
npm run build
# O build ficará em /var/www/booklibrary/frontend/dist
```

---

## 4. Configurar o Nginx

```bash
# Copiar a config do Nginx
sudo cp /var/www/booklibrary/deploy/nginx.conf /etc/nginx/sites-available/booklibrary

# Editar o arquivo e substituir "seudominio.com" pelo domínio/IP real
sudo nano /etc/nginx/sites-available/booklibrary

# Ativar o site
sudo ln -s /etc/nginx/sites-available/booklibrary /etc/nginx/sites-enabled/

# Remover o site padrão (opcional)
sudo rm -f /etc/nginx/sites-enabled/default

# Testar e recarregar
sudo nginx -t
sudo systemctl reload nginx
```

---

## 5. Iniciar o backend com PM2

```bash
cd /var/www/booklibrary
pm2 start ecosystem.config.js
pm2 save

# Verificar status
pm2 status
pm2 logs booklibrary-api
```

---

## 6. SSL com Let's Encrypt (HTTPS)

```bash
sudo certbot --nginx -d biblioteca.g3tsistemas.com.br -d www.biblioteca.g3tsistemas.com.br
# Após concluir, o Certbot edita o nginx.conf automaticamente
sudo systemctl reload nginx
```

---

## 7. Deploys futuros

```bash
# Após atualizar o código no servidor, basta rodar:
cd /var/www/booklibrary
bash deploy/deploy.sh
```

---

## Verificações rápidas

```bash
# API respondendo?
curl http://localhost:3001/api/health

# PM2 rodando?
pm2 status

# Nginx ok?
sudo nginx -t

# Logs em tempo real
pm2 logs booklibrary-api --lines 50
```

---

## Estrutura no servidor

```
/var/www/booklibrary/
├── backend/
│   ├── .env                 ← variáveis de produção (não commitar)
│   ├── data/
│   │   └── booklibrary.db   ← banco SQLite (fazer backup regularmente)
│   └── uploads/covers/      ← capas dos livros
├── frontend/
│   └── dist/                ← build estático servido pelo Nginx
├── deploy/
│   ├── nginx.conf
│   └── deploy.sh
└── ecosystem.config.js      ← config do PM2
```

---

## Backup do banco de dados

```bash
# Adicionar ao crontab (backup diário às 3h)
crontab -e

# Linha a adicionar:
0 3 * * * cp /var/www/booklibrary/backend/data/booklibrary.db /var/backups/booklibrary-$(date +\%Y\%m\%d).db
```
