# 📚 BookLibrary — Roadmap de Implementação

> **Stack:** Node.js + Express (Backend) · React + Vite + TailwindCSS (Frontend) · SQLite (better-sqlite3)

---

## ✅ Sprint 1 — Fundação (CONCLUÍDA)

**Backend:** estrutura, Express, CORS, rate-limit, 13 tabelas SQLite + seeds, middleware auth/requirePlan/upload, auth.controller (register/login/getMe/updateProfile/changePassword), auth.routes, stubs de todas as rotas.

**Frontend:** Vite + React + TailwindCSS, design system dark/light (CSS vars), ThemeContext, AuthContext, Axios com interceptors, App.jsx com todas as rotas, Sidebar colapsável (badges de plano), Navbar (toggle dark/light, avatar), Modal, StarRating, Pagination, LoginPage, RegisterPage, stubs de todas as páginas.

---

## ✅ Sprint 2 — Livros + Categorias + Perfil (CONCLUÍDA)

**Backend:**

- [x] `src/controllers/books.controller.js` — listBooks (search/filtros/paginação), getBook, createBook (valida limite plano), updateBook, deleteBook, autocomplete, exportBooks (csv/json)
- [x] `src/routes/books.routes.js` — rotas autocomplete/export antes de `/:id`
- [x] `src/controllers/categories.controller.js` — listCategories (com bookCount), createCategory, updateCategory, deleteCategory
- [x] `src/routes/categories.routes.js`

**Frontend:**

- [x] `src/components/Book/StatusBadge.jsx`
- [x] `src/components/Book/BookCard.jsx` — capa, fallback no-cover, StatusBadge, StarRating, botões
- [x] `src/pages/Books/BooksPage.jsx` — busca com debounce, filtros, grid, paginação, delete confirm
- [x] `src/pages/Books/BookFormPage.jsx` — criar/editar, preview capa, busca Google Books, todos os campos
- [x] `src/pages/Books/BookDetailPage.jsx` — todos os metadados, placeholders de leitura/empréstimos
- [x] `src/pages/Categories/CategoriesPage.jsx` — CRUD com pill colorido + ícone FontAwesome, modal
- [x] `src/pages/Profile/ProfilePage.jsx` — editar nome/avatar, alterar senha

---

## ✅ Sprint 3 — Leituras + Empréstimos + Estante + Dashboard (CONCLUÍDA)

**Backend:**

- [x] `src/services/gamification.service.js` — updateUserProgress (streak, nível, pontos)
- [x] `src/services/achievement.service.js` — checkAndUnlockAchievements (14 conquistas)
- [x] `src/controllers/reading.controller.js` — listReading, getHistory, getBookProgress, upsertProgress, deleteProgress
- [x] `src/controllers/loans.controller.js` — listLoans, listActive, createLoan, returnLoan, deleteLoan
- [x] `src/controllers/dashboard.controller.js` — getDashboard (stats, currentlyReading, recentBooks, featuredBooks, topRated, categoryStats, userProgress, recentAchievements)
- [x] `src/routes/reading.routes.js`, `loans.routes.js`, `dashboard.routes.js`, `shelf.routes.js`

**Frontend:**

- [x] `src/pages/Dashboard/DashboardPage.jsx` — cards stats, lendo agora, gráfico pizza (Recharts), top 5, progresso gamificação
- [x] `src/pages/Reading/ReadingPage.jsx` — abas Em andamento/Histórico, iniciar leitura, modal de progresso com finalização
- [x] `src/pages/Loans/LoansPage.jsx` — abas Ativos/Histórico, modal novo empréstimo, registrar devolução
- [x] `src/pages/Shelf/ShelfPage.jsx` — estante visual com filtros por status
- [x] `src/pages/Books/BookDetailPage.jsx` — atualizado com histórico de leitura + empréstimos reais

---

## ✅ Sprint 4 — Gamificação + Estatísticas + Google Books + Admin (CONCLUÍDA)

### Backend ✅

- [x] `src/controllers/gamification.controller.js` — GET `/api/gamification` + PUT `/api/gamification/goal`
- [x] `src/controllers/statistics.controller.js` — GET `/api/statistics` (guard: plano premium/pro/master)
- [x] `src/controllers/googleBooks.controller.js` — GET `/search?q=` + POST `/import`
- [x] `src/controllers/admin.controller.js` — dashboard, tenants CRUD, alterar plano
- [x] Rotas: `gamification.routes.js`, `statistics.routes.js`, `googleBooks.routes.js`, `admin.routes.js`
- [x] `auth.controller.js` → `getMe` agora retorna `maxBooks` e `booksUsed`

### Frontend ✅

- [x] `src/components/Gamification/AchievementCard.jsx` — raridade com cores (common/rare/epic/legendary)
- [x] `src/pages/Gamification/GamificationPage.jsx` — nível/XP bar/streak/meta anual SVG/conquistas com filtros
- [x] `src/pages/Statistics/StatisticsPage.jsx` — guard free→upgrade banner, barras mensais, pizza categoria, top autores horizontal, leaderboard
- [x] `src/pages/GoogleBooks/GoogleBooksPage.jsx` — busca + loading + grid resultados + importar
- [x] `src/pages/Billing/BillingPage.jsx` — plano atual, barra uso livros, tabela comparativa 4 planos
- [x] `src/pages/Admin/AdminDashboardPage.jsx` — métricas globais, gráfico crescimento, pizza planos
- [x] `src/pages/Admin/AdminTenantsPage.jsx` — tabela paginada, filtro plano/busca, modal alterar plano, desativar
- [x] `src/pages/Admin/AdminTenantDetailPage.jsx` — info tenant, stats, lista usuários, editar nome

---

## ✅ Sprint 5 — Regras de Negócio Faltantes (CONCLUÍDA)

> Baseado na análise do `BOOKLIBRARY_FUNCIONALIDADES.md` (especificação C#), adaptado para Node/Express/React.

### Backend ✅

- [x] `src/services/planFeature.service.js` — serviço central com todas as regras por plano:
    - `getLimits(plan)` · `canExportData` · `canUseGoogleBooks` · `canUseAdvancedStats`
    - `getMaxAchievementsVisible` (Free=5, resto=∞) · `getMaxNotesLength` (Free=500, Premium/Pro=3000)
    - `getMaxReadingHistoryVisible` (Free=10, resto=∞) · `canViewStreakHistory`
    - `requirePlanFeature(featureKey, featureName)` — middleware Express reutilizável
- [x] `PATCH /api/books/:id/status` — UpdateStatus rápido via AJAX; dispara gamificação se status→`read`
- [x] `GET /api/reading/latest?bookId=X` — GetLatestReading (retorna último progresso de um livro)
- [x] `PATCH /api/reading/:id/page` — UpdatePage com auto-conclusão quando `currentPage >= pages`
- [x] Validação do tamanho das notas por plano em `upsertProgress` (Free=500 chars)
- [x] `POST /api/gamification/recalculate` — recalcula pontos/nível do zero + re-verifica conquistas
- [x] `GET /api/gamification/diagnostic` — diagnóstico completo com stats e limites do plano
- [x] Limite de conquistas visíveis por plano em `GET /api/gamification` (`isLimited`, `lockedAchievements`)
- [x] `POST /api/google-books/enrich/:id` — enriquece campos vazios de livro existente via Google Books
- [x] Google Books import com verificação de duplicidade por ISBN (retorna 409)
- [x] `maxResults` de busca elevado de 20 para 40

### Frontend ✅

- [x] `ReadingPage.jsx` — input inline de página rápida em cada card de leitura em andamento
- [x] `GamificationPage.jsx` — botão "Recalcular" com spinner + banner de conquistas bloqueadas para Free
- [x] `BookDetailPage.jsx` — botão "Enriquecer" (Google Books) visível só para planos pagos

---

## ✅ Sprint 6 — Export, Stats Avançadas, Tenant Usage (CONCLUÍDA)

### Backend ✅

- [x] `GET /api/books/export?format=xlsx` — exportar para Excel com guard `canExportData`
    - Dependência: `xlsx` (SheetJS) instalada
    - Colunas: ID, Título, Autor, ISBN, Editora, Ano, Páginas, Categoria, Status, Avaliação, CDD
- [x] `GET /api/books/export?format=pdf` — exportar para PDF com guard `canExportData`
    - Dependência: `pdfkit` instalada
    - Formato A4 landscape, tabela com 6 colunas, zebra stripe, cabeçalho + rodapé com total e data
- [x] `GET /api/statistics/share-card?type=summary|books|streak` — card de dados para compartilhamento
- [x] `GET /api/statistics` — campos avançados adicionados:
    - `readingTrend` (12 meses corridos com `ym`, `books_count`, `pages_read`)
    - `yearlyComparison` (ano atual vs. anterior: `books_count` e `pages_read`)
    - `readingVelocity` (páginas/dia nos últimos 30 dias)
- [x] `GET /api/tenant/usage` — uso de livros (count/max/%), armazenamento (varrendo arquivos do disco), features por plano
    - Novo `src/controllers/tenant.controller.js` + `src/routes/tenant.routes.js`
    - Registrado em `app.js` como `/api/tenant`
- [x] Dashboard server-side cache em memória por tenant (5 min, invalidado por `?refresh` ou operações de escrita de livros)
    - `POST /api/dashboard/clear-cache` — invalidação manual
    - Dados de gamificação excluídos do cache (sempre frescos)
    - `invalidateCache` chamado em createBook, updateBook, deleteBook, updateStatus
- [x] `validateStorageLimit(tenantId, plan, fileSizeBytes)` — checar limite de armazenamento antes de aceitar upload de capa; deleta o arquivo e retorna 403 se excedido
- [x] Histórico de leitura limitado por plano em `GET /api/reading/history`:
    - Free = até 10 registros visíveis; novos campos `isLimited`, `planLimit`, `totalUnlimited`

### Frontend ✅

- [x] `BooksPage.jsx` — botão de ação rápida de status (hover: menu dropdown com ícones coloridos por status, atualiza via PATCH sem recarregar)
- [x] `BooksPage.jsx` — menu "Exportar" com CSV (livre), Excel e PDF (planos pagos, redireciona para /billing com badge "Pro" se free)
- [x] `StatisticsPage.jsx` — gráfico de tendência 12 meses (`LineChart` corrido) + comparativo anual (barras + indicador diff) + velocidade de leitura no card "pág/dia"
- [x] `BillingPage.jsx` — barra de uso de armazenamento real via `/api/tenant/usage` + números corretos por plano (Free=25, Premium=100, Pro=∞)

---

## ✅ Sprint 7 — Background Jobs, Tenant Setup, Melhorias (CONCLUÍDA)

### Backend ✅

- [x] Background jobs (cron via `node-cron`) em `src/services/jobs.service.js`:
    - `CleanupOldCovers` — remove capas órfãs (sem livro associado) ou com mais de 365 dias sem acesso · diário 03:00
    - `BackupDatabase` — copia `data/*.db` para `data/Backups/` com timestamp, mantém últimos 7 · diário 02:00
    - `EnrichBooksAuto` — enriquece livros sem páginas/ISBN via Google Books API · a cada 6h
- [x] `server.js` — `startJobs()` chamado após `app.listen()` (skip em `NODE_ENV=test`)
- [x] `src/controllers/tenant.controller.js` — novos endpoints:
    - `GET /api/tenant/setup` — info da org + `inviteCode` (gerado e persistido on demand) + `memberCount`
    - `PATCH /api/tenant/setup` — renomear organização (owner only)
    - `POST /api/tenant/join` — entrar em organização via código (migra user; bloqueia se tiver livros)
    - `POST /api/tenant/regenerate-invite` — regenerar código de convite (owner only)
    - Safe migration `ALTER TABLE tenants ADD COLUMN invite_code` (try/catch)
- [x] `src/routes/tenant.routes.js` — 4 novas rotas registradas
- [x] `auth.controller.js` → `updateProfile` já sincronizava `user_name` em `user_progresses` (confirmado ativo)

### Frontend ✅

- [x] `src/context/ToastContext.jsx` — sistema global de notificações (`addToast(msg, type, duration)`)
    - Tipos: `success` · `error` · `warning` · `info` com cores e ícones distintos
    - Animação slide-in/out, auto-dismiss configurável, botão fechar manual
- [x] `src/main.jsx` — `<ToastProvider>` adicionado ao wrapper da app
- [x] `src/pages/Tenant/TenantSetupPage.jsx` — onboarding multi-step:
    - Passo "Escolha": criar/renomear org OU entrar em existente
    - Passo "Configurar": renomear organização + exibir código de convite com botão "Copiar"
    - Passo "Entrar": input de código 8 chars com aviso de perda de biblioteca
    - Indicador de progresso (3 steps) + tela de sucesso final
    - Rota `/setup` adicionada no `App.jsx` (pública, sem layout)
- [x] `src/pages/GoogleBooks/GoogleBooksPage.jsx` — UX melhorada:
    - Filtros de busca: Todos os campos · `intitle:` · `inauthor:` · `isbn:` (pill buttons)
    - Badge "Já importado" pré-marcado para livros cujo ISBN já existe na biblioteca
    - Detecção de duplicata por ISBN no 409 → marca o card e continua permitindo importação
    - Coluna ISBN exibida no card do resultado; ícone de aviso na barra de resultado quando há duplicatas
- [x] Substituição de `alert()` por `addToast()` em 4 páginas:
    - `BooksPage.jsx` — erro de status rápido + erro de exportação
    - `BookFormPage.jsx` — busca Google Books vazia + erro de conexão
    - `ReadingPage.jsx` — erro ao atualizar página
    - `CategoriesPage.jsx` — erro ao excluir categoria

---

### Stack técnica

- **Backend:** Node.js v25 + Express 4 + better-sqlite3 v12 + JWT
- **Frontend:** React 18 + Vite 5 + TailwindCSS 3.4 (`darkMode: 'class'`) + Recharts

### Funcionalidades entregues

| Módulo       | Descrição                                          |
| ------------ | -------------------------------------------------- |
| Auth         | Registro, login, perfil, troca de senha            |
| Livros       | CRUD completo, capa upload, status, avaliação      |
| Categorias   | CRUD com cor e ícone                               |
| Leitura      | Progresso, histórico, finalização, gamificação     |
| Empréstimos  | Loan out/devolução, controle de cópias             |
| Estante      | Visualização por status                            |
| Dashboard    | Estatísticas visuais por usuário                   |
| Gamificação  | XP, nível, streak, conquistas, meta anual          |
| Estatísticas | Avançadas (guard plano premium+)                   |
| Google Books | Busca e importação                                 |
| Billing      | Info de plano, limites, tabela comparativa         |
| Admin        | Dashboard global, gestão de tenants/planos         |
| Tema         | Dark/light persistido em localStorage (`bl-theme`) |

---

## 🔧 Como rodar

```bash
# Terminal 1 — Backend (http://localhost:3001)
cd backend
npm run dev

# Terminal 2 — Frontend (http://localhost:5173)
cd frontend
npm run dev
```

## 📋 Notas técnicas

1. `better-sqlite3 v12+` instalado (compatível com Node.js v25).
2. **Token JWT:** chave `bl-token` no localStorage.
3. **Tema:** classe `dark` no `<html>` + chave `bl-theme` no localStorage.
4. **Capa vazia:** `/images/no-cover.svg`.
5. **Multi-tenancy:** todo controller filtra por `req.user.tenantId`.
6. **Gamificação:** acionar `gamification.service` + `achievement.service` ao finalizar leitura.

7. **Stripe:** na v1 o admin altera planos manualmente via `/api/admin/tenants/:id/plan`.
