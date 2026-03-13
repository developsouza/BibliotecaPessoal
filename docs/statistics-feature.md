# 📊 Documentação — Módulo de Estatísticas Avançadas

> Referência técnica para reimplementação em **Node.js + Express** (backend) e **React** (frontend), baseada na análise do projeto ASP.NET Core `BookLibrary`.

---

## Sumário

1. [Visão Geral](#1-visão-geral)
2. [Controle de Acesso](#2-controle-de-acesso)
3. [Endpoints da API](#3-endpoints-da-api)
4. [Modelos de Dados / DTOs](#4-modelos-de-dados--dtos)
5. [Regras de Negócio e Queries](#5-regras-de-negócio-e-queries)
   - 5.1 [User Stats (Estatísticas Gerais)](#51-user-stats-estatísticas-gerais)
   - 5.2 [Leitura Mensal (Ano Atual)](#52-leitura-mensal-ano-atual)
   - 5.3 [Tendência dos Últimos 12 Meses](#53-tendência-dos-últimos-12-meses)
   - 5.4 [Top 10 Categorias](#54-top-10-categorias)
   - 5.5 [Top 10 Autores](#55-top-10-autores)
   - 5.6 [Comparação Anual (3 anos)](#56-comparação-anual-3-anos)
   - 5.7 [Velocidade de Leitura](#57-velocidade-de-leitura)
   - 5.8 [Top 10 Livros Mais Bem Avaliados](#58-top-10-livros-mais-bem-avaliados)
   - 5.9 [Comparação Social](#59-comparação-social)
   - 5.10 [Leaderboard Global](#510-leaderboard-global)
   - 5.11 [Share Card (Cartão de Compartilhamento)](#511-share-card-cartão-de-compartilhamento)
6. [Insights Inteligentes](#6-insights-inteligentes)
7. [Compartilhamento Social](#7-compartilhamento-social)
8. [Estrutura de Tabelas do Banco de Dados](#8-estrutura-de-tabelas-do-banco-de-dados)
9. [Sugestão de Arquitetura Node.js + React](#9-sugestão-de-arquitetura-nodejs--react)

---

## 1. Visão Geral

O módulo de **Estatísticas Avançadas** exibe análises detalhadas dos hábitos de leitura do usuário autenticado. As funcionalidades incluem:

- Cards de resumo rápido (livros, páginas, streak, avaliação média)
- Velocidade de leitura (últimos 30 e 90 dias)
- Gráficos de tendência mensal (12 meses) com Chart.js
- Análise por categoria e por autor (top 10)
- Comparação anual (últimos 3 anos) com variação percentual
- Top 10 livros mais bem avaliados
- Insights inteligentes gerados dinamicamente
- Comparação social com outros usuários da plataforma
- Ranking/Leaderboard global (top 10)
- Card de compartilhamento em redes sociais (Twitter/X, Facebook, WhatsApp, LinkedIn)

> **Plano necessário:** `AdvancedStats` (feature gate). Usuários sem esse plano são redirecionados.

---

## 2. Controle de Acesso

### ASP.NET (atual)
- Decorator `[Authorize]` na controller → requer usuário autenticado via cookie/Identity.
- Decorator `[RequirePlanFeature(PlanFeature.AdvancedStats)]` → verifica se o plano do tenant permite o recurso.

### Equivalente Node.js + Express

```js
// middleware/auth.js
const authenticate = (req, res, next) => {
  // Verificar JWT no header Authorization: Bearer <token>
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Não autenticado' });
  // Validar e decodificar JWT → req.user = { id, tenantId, planFeatures[] }
  next();
};

// middleware/requirePlanFeature.js
const requirePlanFeature = (feature) => (req, res, next) => {
  if (!req.user.planFeatures.includes(feature)) {
    return res.status(403).json({ error: 'Plano não inclui esta funcionalidade', feature });
  }
  next();
};
```

Uso nas rotas:

```js
router.get('/statistics',
  authenticate,
  requirePlanFeature('AdvancedStats'),
  statisticsController.getStatistics
);
```

---

## 3. Endpoints da API

| Método | Rota | Descrição | Auth | Plano |
|--------|------|-----------|------|-------|
| `GET` | `/api/statistics` | Retorna todas as estatísticas avançadas do usuário | ✅ | `AdvancedStats` |
| `GET` | `/api/statistics/share-card` | Retorna dados do card de compartilhamento | ✅ | `AdvancedStats` |

### GET `/api/statistics`

**Response 200:**

```json
{
  "userStats": { ... },
  "monthlyReadingData": { "Jan": 2, "Fev": 0, ... },
  "readingByCategory": { "Romance": 5, "Ficção": 3, ... },
  "readingByAuthor": { "J.K. Rowling": 4, ... },
  "readingTrendData": [ { "month": "Jan/24", "booksRead": 2, "pagesRead": 450 }, ... ],
  "yearlyComparison": { "2025": { "year": 2025, "booksRead": 12, ... }, ... },
  "readingVelocity": { ... },
  "topRatedBooks": [ { "title": "...", "author": "...", "rating": 5, "categoryName": "..." }, ... ],
  "socialComparison": { ... },
  "globalLeaderboard": [ { "userName": "...", "level": 5, ... }, ... ]
}
```

**Response 401:** Não autenticado.  
**Response 403:** Plano não inclui `AdvancedStats`.

---

### GET `/api/statistics/share-card`

**Query params (opcionais):**

| Parâmetro | Tipo | Padrão | Descrição |
|-----------|------|--------|-----------|
| `type` | `string` | `"summary"` | Tipo do card (`summary`, `books`, `streak`) |

**Response 200:**

```json
{
  "userName": "João Silva",
  "level": 7,
  "totalPoints": 680,
  "booksRead": 34,
  "totalPages": 8200,
  "currentStreak": 12,
  "averageRating": 4.2,
  "favoriteCategory": "Romance",
  "type": "summary"
}
```

---

## 4. Modelos de Dados / DTOs

### `UserStats`

```ts
interface UserStats {
  totalBooks: number;          // Total de livros na biblioteca
  booksRead: number;           // Livros com status "Read"
  booksReading: number;        // Livros com status "Reading"
  booksWantToRead: number;     // Livros com status "WantToRead"
  totalPagesRead: number;      // Total de páginas lidas (livros concluídos + em progresso)
  weeklyPages: number;         // Páginas lidas nos últimos 7 dias
  currentStreak: number;       // Dias consecutivos de leitura (atual)
  longestStreak: number;       // Maior sequência já registrada
  averageRating: number;       // Média de avaliações (0–5), 1 casa decimal
  favoriteCategory: string;    // Categoria com mais livros lidos
  reviewsCount: number;        // Avaliações/notas criadas
  level: number;               // Nível = (totalPoints / 100) + 1
  totalPoints: number;         // Pontos acumulados via conquistas
  yearlyGoalPercent: number;   // % da meta anual atingida
}
```

### `MonthlyTrendData`

```ts
interface MonthlyTrendData {
  month: string;     // Formato "MMM/yy", ex: "Jan/24"
  booksRead: number;
  pagesRead: number; // Soma de PagesRead das ReadingActivities do mês
}
```

### `YearlyStats`

```ts
interface YearlyStats {
  year: number;
  booksRead: number;
  totalPages: number;
  averageRating: number; // 1 casa decimal
}
```

### `ReadingVelocityData`

```ts
interface ReadingVelocityData {
  pagesLast30Days: number;
  pagesLast90Days: number;
  booksLast30Days: number;
  averagePagesPerDay: number; // pagesLast30Days / activeDaysLast30 (1 casa decimal)
  activeDaysLast30: number;   // Dias distintos com atividade de leitura nos últimos 30 dias
}
```

### `TopBookData`

```ts
interface TopBookData {
  title: string;
  author: string;
  rating: number;       // 1–5
  categoryName: string; // "Sem categoria" se não houver
}
```

### `SocialComparisonData`

```ts
interface SocialComparisonData {
  totalActiveUsers: number;   // Usuários com booksRead > 0 ou totalPagesRead > 0
  userBooksRead: number;
  avgBooksRead: number;       // 1 casa decimal
  userPagesRead: number;
  avgPagesRead: number;       // 1 casa decimal
  userStreak: number;
  avgStreak: number;          // 1 casa decimal
  userLevel: number;
  avgLevel: number;           // 1 casa decimal
  rankByBooks: number;        // Posição no ranking por livros lidos
  rankByPages: number;        // Posição no ranking por páginas lidas
  rankByStreak: number;       // Posição no ranking por sequência atual
  rankByPoints: number;       // Posição no ranking por pontos totais
  topPercentile: number;      // Top X% (baseado em rankByBooks), 1 casa decimal
}
```

### `LeaderboardEntry`

```ts
interface LeaderboardEntry {
  userName: string;
  level: number;
  totalPoints: number;
  booksRead: number;
  totalPages: number;
  currentStreak: number;
}
```

### `ShareCardData`

```ts
interface ShareCardData {
  userName: string;
  level: number;
  totalPoints: number;
  booksRead: number;
  totalPages: number;
  currentStreak: number;
  averageRating: number;   // 1 casa decimal
  favoriteCategory: string;
  type: string;            // "summary" | "books" | "streak"
}
```

---

## 5. Regras de Negócio e Queries

> Todas as queries são **filtradas pelo `userId` do usuário autenticado**, exceto onde indicado como "global" (ignoram filtro de tenant).

### 5.1 User Stats (Estatísticas Gerais)

Origem: `GamificationService.GetUserStatsAsync()`

```sql
-- Livros por status
SELECT COUNT(*) FROM Books WHERE userId = :userId AND status = 'Read'        -- booksRead
SELECT COUNT(*) FROM Books WHERE userId = :userId AND status = 'Reading'     -- booksReading
SELECT COUNT(*) FROM Books WHERE userId = :userId AND status = 'WantToRead'  -- booksWantToRead
SELECT COUNT(*) FROM Books WHERE userId = :userId                            -- totalBooks

-- Média de avaliação (apenas livros lidos com rating > 0)
SELECT AVG(rating) FROM Books WHERE userId = :userId AND status = 'Read' AND rating > 0

-- Categoria favorita (mais lida)
SELECT TOP 1 c.name FROM Books b
  JOIN Categories c ON b.categoryId = c.id
  WHERE b.userId = :userId AND b.status = 'Read'
  GROUP BY c.name ORDER BY COUNT(*) DESC

-- Páginas semanais (últimos 7 dias)
SELECT SUM(pagesRead) FROM ReadingActivities
  WHERE userProgressId = :userProgressId
  AND activityDate >= NOW() - INTERVAL '7 days'
```

> `TotalPagesRead`, `CurrentStreak`, `LongestStreak`, `ReviewsCount`, `Level`, `TotalPoints`, `YearlyGoalPercent` vêm do registro `UserProgress` do usuário (tabela desnormalizada, atualizada por triggers/eventos do sistema).

---

### 5.2 Leitura Mensal (Ano Atual)

Origem: `StatisticsController.GetMonthlyReadingDataAsync()`

Retorna um dicionário com os 12 meses do ano atual (Jan–Dez) e a contagem de livros **concluídos** em cada mês.

```sql
SELECT MONTH(createdAt) as month, COUNT(*) as count
FROM Books
WHERE userId = :userId
  AND status = 'Read'
  AND YEAR(createdAt) = YEAR(NOW())
GROUP BY MONTH(createdAt)
```

**Resposta esperada:**

```json
{ "Jan": 2, "Fev": 1, "Mar": 0, "Abr": 3, "Mai": 0, "Jun": 1, "Jul": 0, "Ago": 0, "Set": 0, "Out": 0, "Nov": 0, "Dez": 0 }
```

> Meses sem leitura retornam `0`. Sempre retorna os 12 meses.

---

### 5.3 Tendência dos Últimos 12 Meses

Origem: `StatisticsController.GetReadingTrendDataAsync()`

Retorna array com os últimos 12 meses (do mais antigo ao mais recente), com livros concluídos **e** páginas lidas por mês.

```sql
-- Para cada mês M (de hoje-11 meses até hoje):
SELECT COUNT(*) FROM Books
WHERE userId = :userId AND status = 'Read'
  AND createdAt BETWEEN :startOfMonth AND :endOfMonth

SELECT SUM(pagesRead) FROM ReadingActivities
WHERE userProgressId = :userProgressId
  AND activityDate BETWEEN :startOfMonth AND :endOfMonth
```

**Resposta esperada:**

```json
[
  { "month": "Ago/24", "booksRead": 1, "pagesRead": 220 },
  { "month": "Set/24", "booksRead": 3, "pagesRead": 780 },
  ...
  { "month": "Jul/25", "booksRead": 2, "pagesRead": 410 }
]
```

---

### 5.4 Top 10 Categorias

Origem: `StatisticsController.GetReadingByCategoryAsync()`

```sql
SELECT c.name as category, COUNT(*) as count
FROM Books b
  JOIN Categories c ON b.categoryId = c.id
WHERE b.userId = :userId AND b.status = 'Read' AND b.categoryId IS NOT NULL
GROUP BY c.name
ORDER BY count DESC
LIMIT 10
```

**Resposta esperada:**

```json
{ "Romance": 8, "Ficção Científica": 5, "Fantasia": 4, ... }
```

---

### 5.5 Top 10 Autores

Origem: `StatisticsController.GetTopAuthorsAsync()`

```sql
SELECT author, COUNT(*) as count
FROM Books
WHERE userId = :userId AND status = 'Read'
GROUP BY author
ORDER BY count DESC
LIMIT 10
```

**Resposta esperada:**

```json
{ "J.K. Rowling": 7, "Stephen King": 4, "George R.R. Martin": 3, ... }
```

---

### 5.6 Comparação Anual (3 anos)

Origem: `StatisticsController.GetYearlyComparisonAsync()`

Para cada ano no intervalo `[anoAtual - 2, anoAtual]`:

```sql
-- Livros lidos no ano
SELECT COUNT(*) FROM Books
WHERE userId = :userId AND status = 'Read' AND YEAR(createdAt) = :year

-- Total de páginas no ano
SELECT SUM(pages) FROM Books
WHERE userId = :userId AND status = 'Read' AND YEAR(createdAt) = :year AND pages IS NOT NULL

-- Média de avaliação no ano
SELECT AVG(rating) FROM Books
WHERE userId = :userId AND status = 'Read' AND YEAR(createdAt) = :year AND rating > 0
```

**Resposta esperada:**

```json
{
  "2023": { "year": 2023, "booksRead": 8, "totalPages": 2400, "averageRating": 3.8 },
  "2024": { "year": 2024, "booksRead": 15, "totalPages": 4200, "averageRating": 4.1 },
  "2025": { "year": 2025, "booksRead": 6,  "totalPages": 1800, "averageRating": 4.5 }
}
```

**Cálculo de variação (frontend):**

```ts
const variation = previousYear.booksRead > 0
  ? ((currentYear.booksRead - previousYear.booksRead) / previousYear.booksRead) * 100
  : 0;
```

---

### 5.7 Velocidade de Leitura

Origem: `StatisticsController.GetReadingVelocityAsync()`

```sql
-- Páginas nos últimos 30 dias
SELECT SUM(pagesRead) FROM ReadingActivities
WHERE userProgressId = :userProgressId
  AND activityDate >= NOW() - INTERVAL '30 days'

-- Páginas nos últimos 90 dias
SELECT SUM(pagesRead) FROM ReadingActivities
WHERE userProgressId = :userProgressId
  AND activityDate >= NOW() - INTERVAL '90 days'

-- Livros concluídos nos últimos 30 dias
SELECT COUNT(*) FROM Books
WHERE userId = :userId AND status = 'Read'
  AND createdAt >= NOW() - INTERVAL '30 days'

-- Dias ativos nos últimos 30 dias (dias distintos com atividade)
SELECT COUNT(DISTINCT DATE(activityDate)) FROM ReadingActivities
WHERE userProgressId = :userProgressId
  AND activityDate >= NOW() - INTERVAL '30 days'
```

**Cálculo da média:**

```ts
averagePagesPerDay = activeDaysLast30 > 0
  ? Math.round(pagesLast30Days / activeDaysLast30 * 10) / 10
  : 0;
```

---

### 5.8 Top 10 Livros Mais Bem Avaliados

Origem: `StatisticsController.GetTopRatedBooksAsync(10)`

```sql
SELECT b.title, b.author, b.rating, COALESCE(c.name, 'Sem categoria') as categoryName
FROM Books b
  LEFT JOIN Categories c ON b.categoryId = c.id
WHERE b.userId = :userId AND b.status = 'Read' AND b.rating > 0
ORDER BY b.rating DESC, b.createdAt DESC
LIMIT 10
```

---

### 5.9 Comparação Social

Origem: `StatisticsController.GetSocialComparisonAsync()`

> ⚠️ Esta query é **global** — ignora filtro de tenant. Compara o usuário atual contra **todos os usuários ativos** da plataforma.

```sql
-- Todos os usuários com alguma atividade (global)
SELECT id, booksRead, totalPagesRead, currentStreak, level, totalPoints
FROM UserProgresses
WHERE booksRead > 0 OR totalPagesRead > 0
```

**Cálculo dos rankings (em memória/aplicação):**

```ts
// Ordenar lista decrescente por métrica e encontrar posição do usuário
const rankByBooks   = sorted_by_books.findIndex(u => u.id === userId) + 1;
const rankByPages   = sorted_by_pages.findIndex(u => u.id === userId) + 1;
const rankByStreak  = sorted_by_streak.findIndex(u => u.id === userId) + 1;
const rankByPoints  = sorted_by_points.findIndex(u => u.id === userId) + 1;

// Percentil (quanto % dos usuários ele supera)
const topPercentile = Math.round(
  ((totalUsers - rankByBooks + 1) / totalUsers) * 100 * 10
) / 10;
```

**Médias globais:**

```ts
avgBooksRead  = avg(allUsers.map(u => u.booksRead));
avgPagesRead  = avg(allUsers.map(u => u.totalPagesRead));
avgStreak     = avg(allUsers.map(u => u.currentStreak));
avgLevel      = avg(allUsers.map(u => u.level));
```

**Fallback** (caso não haja outros usuários): retorna os dados do próprio usuário como média e rank `1`.

---

### 5.10 Leaderboard Global

Origem: `StatisticsController.GetGlobalLeaderboardAsync(10)`

> ⚠️ Query **global** — ignora filtro de tenant.

```sql
SELECT up.userName, up.level, up.totalPoints, up.booksRead, up.totalPagesRead, up.currentStreak
FROM UserProgresses up
ORDER BY up.totalPoints DESC, up.booksRead DESC
LIMIT 10
```

O usuário atual é destacado visualmente no frontend quando `entry.userName === currentUserName`.

---

### 5.11 Share Card (Cartão de Compartilhamento)

Origem: `StatisticsController.ShareCard()`

Compõe um objeto com dados do `UserProgress` + `UserStats`:

```ts
{
  userName:        userProgress.userName,
  level:           userProgress.level,
  totalPoints:     userProgress.totalPoints,
  booksRead:       userStats.booksRead,
  totalPages:      userStats.totalPagesRead,
  currentStreak:   userStats.currentStreak,
  averageRating:   userStats.averageRating,
  favoriteCategory: userStats.favoriteCategory,
  type:            query.type ?? "summary"
}
```

---

## 6. Insights Inteligentes

Gerados no **frontend** a partir dos dados de `userStats`. Quatro insights dinâmicos:

### Insight 1 — Ritmo de Leitura

```ts
const avgPagesPerBook = booksRead > 0 ? Math.round(totalPagesRead / booksRead) : 0;
// Texto: "Você leu X livros totalizando Y páginas. Cada livro tem em média Z páginas."
```

### Insight 2 — Categoria Favorita

```ts
// Se favoriteCategory !== "N/A":
//   "Você adora <favoriteCategory>! É sua categoria mais lida."
// Senão:
//   "Explore diferentes categorias para descobrir suas preferências!"
```

### Insight 3 — Sequência Atual

```ts
// Se currentStreak > 0:
//   "Você está há X dias lendo consecutivamente!"
//   + badge "🏆 RECORDE!" se currentStreak === longestStreak
// Senão:
//   "Comece uma sequência lendo hoje!"
```

### Insight 4 — Critério de Avaliação

```ts
const ratingText =
  avgRating >= 4.5 ? "Você é muito exigente e adora livros excepcionais!" :
  avgRating >= 4.0 ? "Você aprecia livros de qualidade!" :
  avgRating >= 3.5 ? "Você tem um gosto equilibrado para leituras." :
  avgRating >= 3.0 ? "Você explora diversos tipos de livros." :
                     "Você está descobrindo suas preferências.";
// Se avgRating === 0: "Comece a avaliar seus livros para ter insights personalizados!"
```

---

## 7. Compartilhamento Social

Gerado dinamicamente com os dados do usuário. O `shareUrl` aponta para a rota pública `GET /statistics/share-card`.

| Rede | URL de compartilhamento |
|------|------------------------|
| Twitter/X | `https://twitter.com/intent/tweet?text=<texto>&url=<url>` |
| Facebook | `https://www.facebook.com/sharer/sharer.php?u=<url>` |
| WhatsApp | `https://api.whatsapp.com/send?text=<texto> <url>` |
| LinkedIn | `https://www.linkedin.com/sharing/share-offsite/?url=<url>` |

**Texto padrão de compartilhamento:**

```
Já li {booksRead} livros no BookLibrary! 📚 Estou no nível {level} e no Top {topPercentile}% dos leitores! 🏆
```

**Download do card como imagem:**  
Usa a biblioteca `html2canvas` para capturar o componente de preview e fazer download como `.png`.

**Open Graph / SEO (página do Share Card):**

```html
<meta property="og:title"       content="{userName} no BookLibrary" />
<meta property="og:description" content="Já li {booksRead} livros totalizando {totalPages} páginas! Estou no nível {level}. 📚" />
<meta property="og:image"       content="{baseUrl}/images/share-card-preview.png" />
<meta property="twitter:card"   content="summary_large_image" />
```

---

## 8. Estrutura de Tabelas do Banco de Dados

### `Books`

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | int (PK) | |
| `userId` | string (FK → Users) | |
| `title` | string | |
| `author` | string | |
| `pages` | int? | Nullable |
| `rating` | int | 0–5 |
| `status` | enum | `Read`, `Reading`, `WantToRead` |
| `categoryId` | int? (FK → Categories) | |
| `createdAt` | datetime | Data em que foi marcado como lido / adicionado |

### `Categories`

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | int (PK) | |
| `name` | string | |

### `ReadingActivities`

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | int (PK) | |
| `userProgressId` | int (FK → UserProgresses) | |
| `bookId` | int? | |
| `pagesRead` | int | Páginas lidas na sessão |
| `activityDate` | datetime | Data da atividade |
| `createdAt` | datetime | |

### `UserProgresses`

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | int (PK) | |
| `userId` | string (FK → Users) | |
| `userName` | string | |
| `booksRead` | int | Desnormalizado |
| `totalPagesRead` | int | Desnormalizado |
| `currentStreak` | int | Dias consecutivos atuais |
| `longestStreak` | int | Maior sequência histórica |
| `level` | int | `(totalPoints / 100) + 1` |
| `totalPoints` | int | Soma de pontos por conquistas |
| `reviewsCount` | int | |
| `yearlyGoalPercent` | int | % da meta anual |
| `lastReadingDate` | datetime? | |
| `createdAt` | datetime | |
| `updatedAt` | datetime | |

---

## 9. Sugestão de Arquitetura Node.js + React

### Backend — Node.js + Express

```
src/
├── routes/
│   └── statistics.routes.js       # Define GET /api/statistics e GET /api/statistics/share-card
├── controllers/
│   └── statistics.controller.js   # Orquestra chamadas aos services
├── services/
│   ├── statistics.service.js      # getUserStats, getMonthlyData, getTrendData, etc.
│   └── gamification.service.js    # getUserProgress, updateStreak, etc.
├── middleware/
│   ├── auth.js                    # Valida JWT e popula req.user
│   └── requirePlanFeature.js      # Verifica feature gate por plano
└── db/
    └── queries/
        └── statistics.queries.js  # Queries SQL separadas
```

**Exemplo de controller:**

```js
// controllers/statistics.controller.js
const statisticsService = require('../services/statistics.service');
const gamificationService = require('../services/gamification.service');

exports.getStatistics = async (req, res) => {
  try {
    const userId = req.user.id;
    const [userStats, monthly, trend, byCategory, byAuthor,
           yearly, velocity, topBooks, social, leaderboard] = await Promise.all([
      gamificationService.getUserStats(userId),
      statisticsService.getMonthlyReadingData(userId),
      statisticsService.getReadingTrendData(userId),
      statisticsService.getReadingByCategory(userId),
      statisticsService.getTopAuthors(userId),
      statisticsService.getYearlyComparison(userId),
      statisticsService.getReadingVelocity(userId),
      statisticsService.getTopRatedBooks(userId, 10),
      statisticsService.getSocialComparison(userId),
      statisticsService.getGlobalLeaderboard(10),
    ]);

    res.json({
      userStats,
      monthlyReadingData: monthly,
      readingTrendData: trend,
      readingByCategory: byCategory,
      readingByAuthor: byAuthor,
      yearlyComparison: yearly,
      readingVelocity: velocity,
      topRatedBooks: topBooks,
      socialComparison: social,
      globalLeaderboard: leaderboard,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao carregar estatísticas' });
  }
};
```

---

### Frontend — React

```
src/
├── pages/
│   └── Statistics/
│       ├── StatisticsPage.jsx         # Página principal (busca dados e distribui props)
│       └── ShareCardPage.jsx          # Página pública do card de compartilhamento
├── components/
│   └── statistics/
│       ├── SummaryCards.jsx           # 4 cards: livros, páginas, streak, avaliação
│       ├── ReadingVelocityCard.jsx    # Velocidade de leitura (30 dias)
│       ├── ReadingTrendChart.jsx      # Gráfico de área — últimos 12 meses (Chart.js)
│       ├── MonthlyBarChart.jsx        # Gráfico de barras — meses do ano atual
│       ├── CategoryPieChart.jsx       # Gráfico de pizza — top 10 categorias
│       ├── AuthorBarChart.jsx         # Gráfico de barras horizontais — top 10 autores
│       ├── YearlyComparisonTable.jsx  # Tabela comparação anual com variação %
│       ├── TopRatedBooksTable.jsx     # Tabela top 10 livros avaliados
│       ├── SmartInsights.jsx          # 4 blocos de insights dinâmicos
│       ├── SocialComparison.jsx       # Cards de comparação vs. média global
│       ├── GlobalLeaderboard.jsx      # Tabela top 10 leitores
│       └── SocialShareCard.jsx        # Preview + botões de compartilhamento
├── hooks/
│   └── useStatistics.js               # Custom hook: fetch + loading + error state
└── services/
    └── statisticsApi.js               # Funções de chamada à API
```

**Exemplo de custom hook:**

```js
// hooks/useStatistics.js
import { useState, useEffect } from 'react';
import { fetchStatistics } from '../services/statisticsApi';

export function useStatistics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchStatistics()
      .then(setData)
      .catch(setError)
      .finally(() => setLoading(false));
  }, []);

  return { data, loading, error };
}
```

**Exemplo de página principal:**

```jsx
// pages/Statistics/StatisticsPage.jsx
import { useStatistics } from '../../hooks/useStatistics';
import SummaryCards from '../../components/statistics/SummaryCards';
import ReadingTrendChart from '../../components/statistics/ReadingTrendChart';
// ... demais imports

export default function StatisticsPage() {
  const { data, loading, error } = useStatistics();

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message={error.message} />;

  return (
    <div className="statistics-page">
      <SummaryCards stats={data.userStats} />
      <ReadingVelocityCard velocity={data.readingVelocity} />
      <ReadingTrendChart trendData={data.readingTrendData} />
      <MonthlyBarChart monthlyData={data.monthlyReadingData} />
      <CategoryPieChart categoryData={data.readingByCategory} />
      <AuthorBarChart authorData={data.readingByAuthor} />
      <YearlyComparisonTable yearlyData={data.yearlyComparison} />
      <TopRatedBooksTable books={data.topRatedBooks} />
      <SmartInsights stats={data.userStats} />
      <SocialComparison social={data.socialComparison} />
      <GlobalLeaderboard
        leaderboard={data.globalLeaderboard}
        currentUserName={data.userStats.userName}
        totalActiveUsers={data.socialComparison.totalActiveUsers}
      />
      <SocialShareCard social={data.socialComparison} stats={data.userStats} />
    </div>
  );
}
```

---

> **Bibliotecas recomendadas:**
> - Gráficos: [`chart.js`](https://www.chartjs.org/) + [`react-chartjs-2`](https://react-chartjs-2.js.org/)
> - Download de imagem: [`html2canvas`](https://html2canvas.hertzen.com/)
> - Ícones: [`react-icons`](https://react-icons.github.io/react-icons/) (equivalente ao Font Awesome)
> - HTTP client: [`axios`](https://axios-http.com/) ou `fetch` nativo
