# 🏆 Sistema de Gamificação — Documentação Técnica

> Documentação gerada a partir do projeto **BookLibrary** (.NET 9 / ASP.NET Core Razor Pages + MVC).  
> Objetivo: servir de referência completa para reimplementar o sistema de conquistas/gamificação em outro sistema.

---

## Sumário

1. [Visão Geral](#1-visão-geral)
2. [Modelos de Dados](#2-modelos-de-dados)
   - [Achievement](#21-achievement)
   - [UserProgress](#22-userprogress)
   - [UserAchievement](#23-userachievement)
3. [Enumerações](#3-enumerações)
4. [Interface do Serviço](#4-interface-do-serviço)
5. [Serviço — GamificationService](#5-serviço--gamificationservice)
   - [GetOrCreateUserProgressAsync](#51-getorcreateuserprogressasync)
   - [UpdateUserProgressAsync](#52-updateuserprogressasync)
   - [CheckAndUnlockAchievementsAsync](#53-checkandunlockachievementsasync)
   - [GetAllAchievementsAsync](#54-getallachiievementsasync)
   - [GetUserAchievementsAsync](#55-getuserachievementsasync)
6. [Controller — GamificationController](#6-controller--gamificationcontroller)
   - [GET /Gamification/Index](#61-get-gamificationindex)
   - [POST /Gamification/UpdateProgress](#62-post-gamificationupdateprogress)
   - [GET /Gamification/DiagnosticProgress](#63-get-gamificationdiagnosticprogress)
   - [POST /Gamification/SetYearlyGoal](#64-post-gamificationsetyearlygoal)
   - [GET /Gamification/Leaderboard](#65-get-gamificationleaderboard)
7. [View — Index.cshtml](#7-view--indexcshtml)
8. [Seed de Conquistas — AchievementSeeder](#8-seed-de-conquistas--achievementseeder)
9. [Catálogo Completo de Conquistas](#9-catálogo-completo-de-conquistas)
10. [Regras de Negócio](#10-regras-de-negócio)
11. [Integração com Planos (Multi-Tenant)](#11-integração-com-planos-multi-tenant)
12. [Checklist de Implementação](#12-checklist-de-implementação)

---

## 1. Visão Geral

O sistema de gamificação recompensa os usuários com **conquistas**, **pontos** e **níveis** conforme interagem com a aplicação (leitura de livros, adição à biblioteca, avaliações etc.).

### Fluxo Principal

```
Usuário realiza ação (marca livro como lido, escreve resenha...)
        ↓
UpdateUserProgressAsync() — recalcula BooksRead, PagesRead, ReviewsCount
        ↓
CheckAndUnlockAchievementsAsync() — verifica conquistas não desbloqueadas
        ↓
Novas conquistas → adiciona UserAchievement + soma Points em UserProgress
        ↓
Level = (TotalPoints / 100) + 1
```

---

## 2. Modelos de Dados

### 2.1 `Achievement`

Representa uma conquista/medalha **global** (compartilhada entre todos os tenants).

```csharp
public class Achievement
{
    public int Id { get; set; }
    public Guid TenantId { get; set; }          // tenant do master (conquistas são globais)
    public string Name { get; set; }             // Ex: "Primeiro Passo"
    public string Description { get; set; }      // Ex: "Leia seu primeiro livro"
    public string Icon { get; set; } = "🏆";    // Emoji ou classe CSS
    public AchievementType Type { get; set; }   // Critério de desbloqueio
    public int Requirement { get; set; }         // Valor mínimo para desbloquear
    public int Points { get; set; }              // Pontos concedidos ao desbloquear
    public AchievementRarity Rarity { get; set; } = AchievementRarity.Common;
    public DateTime CreatedAt { get; set; }
    public ICollection<UserAchievement> UserAchievements { get; set; }
}
```

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `Name` | `string(100)` | Nome exibido da conquista |
| `Description` | `string(300)` | Descrição do critério |
| `Icon` | `string(50)` | Emoji representativo |
| `Type` | `AchievementType` | Qual métrica é avaliada |
| `Requirement` | `int` | Valor mínimo da métrica |
| `Points` | `int` | XP concedido |
| `Rarity` | `AchievementRarity` | Common / Rare / Epic / Legendary |

---

### 2.2 `UserProgress`

Perfil gamificado do usuário. **Um registro por usuário**.

```csharp
public class UserProgress
{
    public int Id { get; set; }
    public Guid TenantId { get; set; }
    public string UserId { get; set; }           // ASP.NET Identity UserId
    public string UserName { get; set; } = "Leitor";
    public int TotalPoints { get; set; } = 0;
    public int Level { get; set; } = 1;          // calculado: (TotalPoints / 100) + 1
    public int BooksRead { get; set; } = 0;
    public int TotalPagesRead { get; set; } = 0;
    public int CurrentStreak { get; set; } = 0;  // dias consecutivos lendo
    public int LongestStreak { get; set; } = 0;
    public DateTime? LastReadingDate { get; set; }
    public int YearlyGoal { get; set; } = 12;    // meta anual em livros
    public int ReviewsCount { get; set; } = 0;
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    // Propriedades calculadas (não persistidas)
    public int PointsForNextLevel => Level * 100;
    public int LevelProgressPercent { get; }     // 0-100%, progresso p/ próximo nível
    public int YearlyGoalPercent { get; }        // 0-100%, progresso da meta anual
}
```

#### Fórmulas Calculadas

```
PointsForNextLevel = Level * 100

LevelProgressPercent:
  pointsInCurrentLevel = TotalPoints - ((Level - 1) * 100)
  percent = Min(100, (pointsInCurrentLevel / PointsForNextLevel) * 100)

YearlyGoalPercent:
  percent = Min(100, (BooksRead / YearlyGoal) * 100)

Level = (TotalPoints / 100) + 1
```

---

### 2.3 `UserAchievement`

Tabela de relacionamento: conquistas desbloqueadas por usuário.

```csharp
public class UserAchievement
{
    public int Id { get; set; }
    public Guid TenantId { get; set; }
    public int UserProgressId { get; set; }      // FK → UserProgress
    public int AchievementId { get; set; }        // FK → Achievement
    public DateTime UnlockedAt { get; set; }      // data do desbloqueio
    public bool HasBeenViewed { get; set; } = false; // para notificações
}
```

---

## 3. Enumerações

### `AchievementType` — Tipos de Critério

| Valor | Descrição | Métrica Avaliada |
|-------|-----------|------------------|
| `BooksRead` | Livros lidos | `UserProgress.BooksRead` |
| `BooksInLibrary` | Livros na biblioteca | `COUNT(Books)` |
| `ReadingStreak` | Dias consecutivos lendo | `UserProgress.CurrentStreak` |
| `PagesRead` | Total de páginas lidas | `UserProgress.TotalPagesRead` |
| `GenreExplorer` | Categorias distintas lidas | `COUNT DISTINCT(CategoryId)` onde `Status = Read` |
| `FastReader` | Velocidade de leitura | *(não implementado na verificação atual)* |
| `Reviewer` | Avaliações ou resenhas | `UserProgress.ReviewsCount` |
| `CompletionRate` | Taxa de conclusão | *(não implementado na verificação atual)* |
| `YearlyGoal` | Meta anual de leitura | `UserProgress.YearlyGoalPercent` |

### `AchievementRarity` — Raridade

| Valor | Exibição | Cor sugerida |
|-------|----------|--------------|
| `Common` | 🥉 Comum | `#95a5a6` (cinza) |
| `Rare` | 🥈 Rara | `#3498db` (azul) |
| `Epic` | 🥇 Épica | `#9b59b6` (roxo) |
| `Legendary` | 💎 Lendária | `#f39c12` (dourado) |

---

## 4. Interface do Serviço

```csharp
public interface IGamificationService
{
    Task<UserProgress> GetOrCreateUserProgressAsync(string? userId = null);
    Task UpdateUserProgressAsync(string? userId = null);
    Task<List<Achievement>> GetAllAchievementsAsync();
    Task<List<UserAchievement>> GetUserAchievementsAsync(string? userId = null);
    Task CheckAndUnlockAchievementsAsync(string? userId = null);
    Task RegisterReadingActivityAsync(int? bookId, int pagesRead, string? userId = null);
    Task UpdateStreakAsync(string? userId = null);
    Task<Dictionary<string, object>> GetUserStatsAsync(string? userId = null);
    Task RecalculatePointsAsync(string? userId = null);
    Task UpdateProgressWithRecalculationAsync(string? userId = null);
}
```

---

## 5. Serviço — GamificationService

Dependências injetadas:
- `AppDbContext` — acesso ao banco de dados (EF Core)
- `IHttpContextAccessor` — para obter o `UserId` do usuário autenticado

```csharp
public class GamificationService : IGamificationService
{
    private readonly AppDbContext _context;
    private readonly IHttpContextAccessor _httpContextAccessor;

    private string GetCurrentUserId()
        => _httpContextAccessor.HttpContext?.User?.FindFirstValue(ClaimTypes.NameIdentifier) ?? "default";
}
```

---

### 5.1 `GetOrCreateUserProgressAsync`

Busca o `UserProgress` do usuário ou cria um novo caso não exista.

**Comportamento:**
- Usa `IgnoreQueryFilters()` para ignorar filtros de multi-tenancy (UserProgress é por usuário, não por tenant ativo).
- Inclui `UserAchievements` e respectivos `Achievement` com `.Include().ThenInclude()`.
- Trata **race condition** (criação simultânea): captura `DbUpdateException` com `SqlException` 2627/2601 (UNIQUE constraint), aguarda 50ms e re-consulta.

```
GET UserProgress WHERE UserId = :userId
  → encontrado → retorna
  → não encontrado → busca User → cria UserProgress → salva
    → UNIQUE violation (race condition) → aguarda 50ms → re-consulta
```

---

### 5.2 `UpdateUserProgressAsync`

Recalcula e persiste as métricas do usuário.

**O que é recalculado:**

| Campo | Fonte |
|-------|-------|
| `BooksRead` | `COUNT(Books WHERE Status = Read)` |
| `TotalPagesRead` | `SUM(Pages WHERE Status = Read)` + `SUM(CurrentPage WHERE Status = Reading)` |
| `ReviewsCount` | `COUNT(ReadingProgresses WHERE Notes != null OR Rating > 0)` |
| `Level` | `(TotalPoints / 100) + 1` |
| `UpdatedAt` | `DateTime.Now` |

Após salvar, chama `CheckAndUnlockAchievementsAsync()` automaticamente.

---

### 5.3 `CheckAndUnlockAchievementsAsync`

Verifica todas as conquistas ainda não desbloqueadas e desbloqueia as elegíveis.

**Lógica de verificação por tipo:**

```csharp
bool unlocked = achievement.Type switch
{
    AchievementType.BooksRead       => userProgress.BooksRead >= achievement.Requirement,
    AchievementType.BooksInLibrary  => await _context.Books.CountAsync() >= achievement.Requirement,
    AchievementType.ReadingStreak   => userProgress.CurrentStreak >= achievement.Requirement,
    AchievementType.PagesRead       => userProgress.TotalPagesRead >= achievement.Requirement,
    AchievementType.GenreExplorer   => await CheckGenreExplorerAsync(achievement.Requirement),
    AchievementType.Reviewer        => userProgress.ReviewsCount >= achievement.Requirement,
    AchievementType.YearlyGoal      => userProgress.YearlyGoalPercent >= achievement.Requirement,
    _                               => false
};
```

**`CheckGenreExplorerAsync`:**
```csharp
// Conta categorias distintas de livros com status = Read
var distinctCategories = await _context.Books
    .Where(b => b.Status == ReadingStatus.Read && b.CategoryId.HasValue)
    .Select(b => b.CategoryId)
    .Distinct()
    .CountAsync();

return distinctCategories >= requirement;
```

**Ao desbloquear:**
1. Cria `UserAchievement` com `HasBeenViewed = false`
2. Soma `achievement.Points` em `userProgress.TotalPoints`
3. Recalcula `Level = (TotalPoints / 100) + 1`
4. Salva tudo em uma única chamada a `SaveChangesAsync()`

---

### 5.4 `GetAllAchievementsAsync`

Retorna todas as conquistas ordenadas por raridade e depois por requisito.

```csharp
return await _context.Achievements
    .AsTracking()
    .OrderBy(a => a.Rarity)
    .ThenBy(a => a.Requirement)
    .ToListAsync();
```

> ⚠️ Conquistas são **globais** — não filtradas por tenant.

---

### 5.5 `GetUserAchievementsAsync`

Retorna as conquistas desbloqueadas pelo usuário, ordenadas da mais recente para a mais antiga.

```csharp
return await _context.UserAchievements
    .IgnoreQueryFilters()
    .Include(ua => ua.Achievement)
    .Where(ua => ua.UserProgressId == userProgress.Id)
    .OrderByDescending(ua => ua.UnlockedAt)
    .ToListAsync();
```

---

## 6. Controller — GamificationController

```csharp
[Authorize]
public class GamificationController : Controller
```

Dependências:
- `IGamificationService`
- `ITenantService` — para obter `TenantId` ao limpar cache
- `IMemoryCache` — invalida cache do dashboard após mudanças
- `IPlanFeatureService` — limite de conquistas visíveis por plano

---

### 6.1 `GET /Gamification/Index`

Página principal de gamificação.

**Dados carregados:**

| ViewBag / Model | Tipo | Descrição |
|-----------------|------|-----------|
| `Model` | `List<Achievement>` | Conquistas visíveis (limitadas pelo plano) |
| `ViewBag.UserProgress` | `UserProgress` | Progresso do usuário |
| `ViewBag.UserAchievements` | `List<UserAchievement>` | Conquistas desbloqueadas |
| `ViewBag.UnlockedIds` | `HashSet<int>` | IDs das conquistas desbloqueadas |
| `ViewBag.Stats` | `Dictionary<string, object>` | Estatísticas do usuário |
| `ViewBag.MaxAchievements` | `int` | Limite do plano atual |
| `ViewBag.TotalAchievements` | `int` | Total de conquistas no sistema |
| `ViewBag.IsLimited` | `bool` | Se o plano limita a visualização |
| `ViewBag.LockedAchievements` | `List<Achievement>` | Conquistas ocultas (premium) |

**Headers de cache adicionados:**
```
Cache-Control: no-cache, no-store, must-revalidate
Pragma: no-cache
Expires: 0
```

---

### 6.2 `POST /Gamification/UpdateProgress`

Atualiza manualmente o progresso e conquistas do usuário.

1. Chama `UpdateProgressWithRecalculationAsync()`
2. Invalida cache do dashboard: `_cache.Remove($"Dashboard_Data_{tenantId}")`
3. Redireciona para `Index` com `TempData["Success"]`

---

### 6.3 `GET /Gamification/DiagnosticProgress`

Endpoint JSON de diagnóstico. Retorna o estado atual do `UserProgress` e stats.

**Response (JSON):**
```json
{
  "success": true,
  "data": {
    "userProgress": {
      "Id": 1,
      "UserId": "...",
      "UserName": "...",
      "TenantId": "...",
      "BooksRead": 5,
      "TotalPagesRead": 1200,
      "TotalPoints": 160,
      "Level": 2,
      "CurrentStreak": 3,
      "ReviewsCount": 2,
      "UpdatedAt": "2025-01-01T10:00:00"
    },
    "stats": { ... },
    "timestamp": "2025-01-01T10:00:00"
  }
}
```

---

### 6.4 `POST /Gamification/SetYearlyGoal`

Define a meta anual de leitura do usuário.

**Parâmetro:** `int goal` (via form)  
**Validação:** `Math.Max(1, Math.Min(365, goal))` — valor entre 1 e 365  
Invalida cache do dashboard e redireciona para `Index`.

---

### 6.5 `GET /Gamification/Leaderboard`

Exibe o leaderboard. Carrega stats via `GetUserStatsAsync()` e passa para a view `Leaderboard`.

---

## 7. View — `Index.cshtml`

**Model:** `List<Achievement>` (conquistas visíveis ao plano)

### Seções da View

#### 7.1 Perfil do Usuário
- Nome (`UserProgress.UserName`)
- Nível com badge (`⭐ Nível X`)
- Total de pontos
- Barra de progresso para o próximo nível (`LevelProgressPercent`)
- Contador de conquistas desbloqueadas

#### 7.2 Estatísticas (4 cards)

| Card | Dado | ViewBag Key |
|------|------|-------------|
| 📚 Livros Lidos | `stats["BooksRead"]` | `ViewBag.Stats` |
| 📄 Páginas Lidas | `stats["TotalPagesRead"]` | `ViewBag.Stats` |
| 🔥 Dias de Sequência | `stats["CurrentStreak"]` | `ViewBag.Stats` |
| ⭐ Média de Avaliação | `stats["AverageRating"]` | `ViewBag.Stats` |

#### 7.3 Meta Anual
- Progresso: `BooksRead / YearlyGoal` com barra `YearlyGoalPercent`
- Formulário `POST SetYearlyGoal` com `<input type="number" min="1" max="365">`

#### 7.4 Grade de Conquistas
- Agrupadas por `AchievementRarity` (iteração com `Enum.GetValues<AchievementRarity>()`)
- Colunas: `col-xl-3 col-lg-4 col-md-6`
- Card desbloqueado: classe `unlocked` + badge verde `✓` + data de desbloqueio
- Card bloqueado: classe `locked` + badge cinza `🔒`
- Exibe: ícone, nome, descrição, requisito traduzido, pontos (`+X pts`)

**Classes CSS de raridade:** `rarity-common`, `rarity-rare`, `rarity-epic`, `rarity-legendary`

**Tradução de tipos na view:**
```csharp
var typeTranslation = achievement.Type switch
{
    AchievementType.BooksRead       => "Livros Lidos",
    AchievementType.BooksInLibrary  => "Livros na Biblioteca",
    AchievementType.ReadingStreak   => "Dias de Sequência",
    AchievementType.PagesRead       => "Páginas Lidas",
    AchievementType.GenreExplorer   => "Categorias Exploradas",
    AchievementType.Reviewer        => "Avaliações",
    _                               => achievement.Type.ToString()
};
```

#### 7.5 Seção Premium (Conquistas Bloqueadas)
Exibida apenas quando `ViewBag.IsLimited == true`.

- Fundo gradiente (`#667eea → #764ba2`)
- Preview de até 6 conquistas com blur + ícone de cadeado
- Benefícios do upgrade em lista
- Botão CTA com animação `bounce` → redireciona para `Billing/Upgrade`

#### 7.6 Botão de Atualização Manual
- `POST /Gamification/UpdateProgress`

---

## 8. Seed de Conquistas — `AchievementSeeder`

```csharp
public static async Task SeedAchievementsAsync(AppDbContext context)
```

- Executa apenas se **não existir nenhuma conquista** no banco
- Usa o `TenantId` do tenant "Master Admin Library" (conquistas globais)
- Insere todas as conquistas via `AddRangeAsync` + `SaveChangesAsync`

**Chamada sugerida no startup:**
```csharp
await AchievementSeeder.SeedAchievementsAsync(app.Services.GetRequiredService<AppDbContext>());
```

---

## 9. Catálogo Completo de Conquistas

### 📚 Livros Lidos (`BooksRead`)

| Nome | Requisito | Pontos | Raridade | Ícone |
|------|-----------|--------|----------|-------|
| Primeiro Passo | 1 livro | 10 | Common | 📖 |
| Leitor Iniciante | 5 livros | 50 | Common | 📚 |
| Leitor Regular | 10 livros | 100 | Rare | 📗 |
| Bibliófilo | 25 livros | 250 | Epic | 📘 |
| Mestre dos Livros | 50 livros | 500 | Legendary | 📕 |
| Lenda da Leitura | 100 livros | 1000 | Legendary | 🏆 |

### 🏠 Biblioteca (`BooksInLibrary`)

| Nome | Requisito | Pontos | Raridade | Ícone |
|------|-----------|--------|----------|-------|
| Colecionador Iniciante | 10 livros | 30 | Common | 🏠 |
| Biblioteca Crescente | 25 livros | 75 | Rare | 🏛️ |
| Curador | 50 livros | 150 | Epic | 📚 |
| Biblioteca Real | 100 livros | 300 | Legendary | 👑 |

### 🔥 Sequência de Leitura (`ReadingStreak`)

| Nome | Requisito | Pontos | Raridade | Ícone |
|------|-----------|--------|----------|-------|
| Consistência | 3 dias | 30 | Common | 🔥 |
| Uma Semana | 7 dias | 70 | Rare | ⭐ |
| Dedicação Total | 30 dias | 300 | Epic | 💫 |
| Inabalável | 100 dias | 1000 | Legendary | 💎 |

### 📄 Páginas Lidas (`PagesRead`)

| Nome | Requisito | Pontos | Raridade | Ícone |
|------|-----------|--------|----------|-------|
| 100 Páginas | 100 pág. | 20 | Common | 📄 |
| Devorador de Páginas | 1.000 pág. | 100 | Rare | 📃 |
| Maratonista | 5.000 pág. | 500 | Epic | 🏃 |
| Biblioteca Ambulante | 10.000 pág. | 1000 | Legendary | 🌟 |

### 🎭 Explorador de Gêneros (`GenreExplorer`)

| Nome | Requisito | Pontos | Raridade | Ícone |
|------|-----------|--------|----------|-------|
| Mente Aberta | 3 categorias | 50 | Common | 🎭 |
| Explorador Cultural | 5 categorias | 100 | Rare | 🌍 |
| Renascentista | 10 categorias | 200 | Epic | 🎨 |

### ✍️ Avaliações (`Reviewer`)

| Nome | Requisito | Pontos | Raridade | Ícone |
|------|-----------|--------|----------|-------|
| Primeira Opinião | 1 avaliação | 10 | Common | ✍️ |
| Crítico Amador | 10 avaliações | 100 | Rare | 📝 |
| Crítico Profissional | 25 avaliações | 250 | Epic | 🎯 |

### 🎯 Meta Anual (`YearlyGoal`)

| Nome | Requisito | Pontos | Raridade | Ícone |
|------|-----------|--------|----------|-------|
| No Caminho Certo | 50% da meta | 100 | Rare | 🎯 |
| Meta Alcançada! | 100% da meta | 500 | Epic | 🏅 |

**Total: 27 conquistas | Total de pontos possíveis: 5.535 pts**

---

## 10. Regras de Negócio

### Pontuação e Níveis

```
TotalPoints += achievement.Points   // ao desbloquear conquista
Level = (TotalPoints / 100) + 1    // atualizado após cada conquista
PointsForNextLevel = Level * 100   // pontos necessários p/ o próximo nível
```

**Exemplos:**
- 0–99 pts → Nível 1
- 100–199 pts → Nível 2
- 200–299 pts → Nível 3
- 1000+ pts → Nível 11+

### Meta Anual

- Padrão: 12 livros/ano
- Mínimo configurável: 1 | Máximo: 365
- Calculada como percentual: `(BooksRead / YearlyGoal) * 100`
- Conquistas de `YearlyGoal` usam esse percentual como requisito

### Streak (Sequência)

- `CurrentStreak` é atualizado por `UpdateStreakAsync()`
- Armazena `LastReadingDate` para calcular dias consecutivos
- `LongestStreak` preserva o recorde histórico

### Conquistas Globais

- Todas as conquistas têm `TenantId` do tenant Master
- **Não são filtradas por tenant** — `IgnoreQueryFilters()` é usado na consulta
- Cada `UserAchievement` guarda o `TenantId` do usuário que a desbloqueou

### Race Condition

- Ao criar `UserProgress`, a violação de UNIQUE constraint (SQL 2627/2601) é capturada
- Aguarda 50ms e re-consulta para garantir que o registro criado por outra thread seja encontrado

---

## 11. Integração com Planos (Multi-Tenant)

O método `IPlanFeatureService.GetMaxAchievementsVisibleAsync()` retorna o número máximo de conquistas visíveis para o plano do tenant atual.

**Comportamento no controller:**
```csharp
var maxAchievements = await _planFeatureService.GetMaxAchievementsVisibleAsync();
var limitedAchievements = achievements.Take(maxAchievements).ToList();   // exibidas
var lockedAchievements = achievements.Skip(maxAchievements).ToList();    // premium (blur)
```

**Na view:**
- Se `IsLimited == true`: exibe alerta + seção premium com preview borrado das conquistas bloqueadas
- Botão de upgrade aponta para `Billing/Upgrade`

> 💡 Para reimplementar **sem multi-tenancy**, basta remover a verificação de `maxAchievements` e exibir todas as conquistas diretamente.

---

## 12. Checklist de Implementação

### Banco de Dados
- [ ] Tabela `Achievements` (Id, TenantId, Name, Description, Icon, Type, Requirement, Points, Rarity, CreatedAt)
- [ ] Tabela `UserProgresses` (Id, TenantId, UserId, UserName, TotalPoints, Level, BooksRead, TotalPagesRead, CurrentStreak, LongestStreak, LastReadingDate, YearlyGoal, ReviewsCount, CreatedAt, UpdatedAt)
- [ ] Tabela `UserAchievements` (Id, TenantId, UserProgressId, AchievementId, UnlockedAt, HasBeenViewed)
- [ ] Constraint UNIQUE em `UserProgresses.UserId`
- [ ] FK `UserAchievements.UserProgressId → UserProgresses.Id`
- [ ] FK `UserAchievements.AchievementId → Achievements.Id`

### Enumerações
- [ ] `AchievementType` (8 valores)
- [ ] `AchievementRarity` (4 valores: Common, Rare, Epic, Legendary)

### Serviço
- [ ] Interface `IGamificationService` com os 10 métodos
- [ ] `GetOrCreateUserProgressAsync` com tratamento de race condition
- [ ] `UpdateUserProgressAsync` recalculando todas as métricas
- [ ] `CheckAndUnlockAchievementsAsync` com switch por `AchievementType`
- [ ] `CheckGenreExplorerAsync` para contagem de categorias distintas
- [ ] `GetAllAchievementsAsync`, `GetUserAchievementsAsync`
- [ ] `GetUserStatsAsync` retornando `Dictionary<string, object>`
- [ ] `UpdateProgressWithRecalculationAsync` (wrapper)
- [ ] Registro no DI: `services.AddScoped<IGamificationService, GamificationService>()`

### Controller
- [ ] `[Authorize]` em toda a controller
- [ ] `[ResponseCache(NoStore = true)]` na action `Index`
- [ ] Headers anti-cache na `Index`
- [ ] Invalidar cache do dashboard no `UpdateProgress` e `SetYearlyGoal`
- [ ] `DiagnosticProgress` para debugging em produção

### View
- [ ] Seção de perfil com barra de progresso de nível
- [ ] 4 cards de estatísticas
- [ ] Formulário de meta anual
- [ ] Grade de conquistas agrupadas por raridade
- [ ] Classes CSS: `.achievement-card`, `.unlocked`, `.locked`, `.rarity-{tipo}`
- [ ] Animações: `pulse-glow`, `fadeInUp`, `bounce`
- [ ] Seção premium com blur (opcional, para planos)

### Seed
- [ ] `AchievementSeeder.SeedAchievementsAsync()` com as 27 conquistas
- [ ] Chamar no startup apenas se não existir nenhuma conquista

---

*Documentação gerada automaticamente pelo GitHub Copilot a partir do código-fonte do projeto BookLibrary.*
