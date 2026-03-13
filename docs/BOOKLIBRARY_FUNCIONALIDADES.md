# 📚 BookLibrary — Documentação de Funcionalidades por Controller/Serviço

> Documento técnico detalhado descrevendo todas as ações, regras de negócio, validações e comportamentos de cada componente do sistema.

---

## Sumário

1. [HomeController](#1-homecontroller)
2. [BooksController](#2-bookscontroller)
3. [CategoriesController](#3-categoriescontroller)
4. [ReadingController](#4-readingcontroller)
5. [ShelfController](#5-shelfcontroller)
6. [GamificationController](#6-gamificationcontroller)
7. [StatisticsController](#7-statisticscontroller)
8. [GoogleBooksController](#8-googlebookscontroller)
9. [BillingController](#9-billingcontroller)
10. [TenantController](#10-tenantcontroller)
11. [TenantSetupController](#11-tenantsetupcontroller)
12. [Admin / AdminController](#12-admin--admincontroller)
13. [Admin / TenantsController](#13-admin--tenantscontroller)
14. [Serviços](#14-serviços)
    - [GamificationService](#141-gamificationservice)
    - [TenantLimitService](#142-tenantlimitservice)
    - [PlanFeatureService](#143-planfeatureservice)
    - [PaymentService](#144-paymentservice)
    - [GoogleBooksService](#145-googlebooksservice)
    - [ExportService](#146-exportservice)
    - [BackgroundJobService](#147-backgroundjobservice)
15. [Repositórios](#15-repositórios)
    - [BookRepository](#151-bookrepository)
    - [CategoryRepository](#152-categoryrepository)
16. [Middleware](#16-middleware)
    - [TenantResolverMiddleware](#161-tenantresolvermiddleware)
    - [TenantSaveChangesInterceptor](#162-tenantsavechangesinterceptor)
17. [Filtros (Attributes)](#17-filtros-attributes)
    - [RequirePlanFeatureAttribute](#171-requireplanfeatureattribute)
    - [ValidateTenantAttribute](#172-validatetenantattribute)

---

## 1. HomeController

**Rota base:** `/`  
**Autenticação:** Obrigatória (`[Authorize]`)

### Ações

---

#### `GET /` — `Index()`

**Descrição:** Carrega o **Dashboard principal** do usuário.

**Regras e comportamento:**
- Constrói uma chave de cache por `TenantId`: `Dashboard_Data_{tenantId}`.
- Se a query string `?refresh` estiver presente, o cache é invalidado antes de buscar os dados.
- Os dados do dashboard são **cacheados por 5 minutos** em memória.
- Os dados de **gamificação (UserProgress) NÃO são cacheados** — sempre buscados frescos para refletir pontos e nível atualizados.
- Adiciona headers HTTP de `no-cache` para evitar cache do navegador.

**Dados carregados (via `IBookRepository`):**
| Dado | Método | Descrição |
|---|---|---|
| `Stats` | `GetDashboardStatsAsync()` | Total de livros, lidos, lendo, quero ler, páginas |
| `RecentBooks` | `GetRecentBooksAsync(5)` | Últimos 5 livros cadastrados |
| `FeaturedBooks` | `GetFeaturedBooksAsync(4)` | Até 4 livros com `IsFeatured = true` |
| `CurrentlyReading` | `GetCurrentlyReadingAsync()` | Livros com status `Reading` |
| `CategoryStats` | `GetCategoryStatsAsync()` | Contagem de livros por categoria |
| `TopRated` | `GetTopRatedAsync(5)` | Top 5 livros com maior avaliação |

**Dados de gamificação (via `IGamificationService`):**
- `GetOrCreateUserProgressAsync()` → retorna o `UserProgress` atual (cria se não existir)

---

#### `POST /Home/ClearCache` — `ClearCache()`

**Descrição:** Limpa manualmente o cache do dashboard do usuário atual.

**Regras:**
- Remove a chave `Dashboard_Data_{tenantId}` do cache em memória.
- Redireciona para `Index` com mensagem de sucesso.

---

#### `GET /Home/Error` — `Error()`

**Descrição:** Página de erro genérica.

**Regras:**
- `[AllowAnonymous]` — acessível sem autenticação.
- Não utiliza cache de resposta.

---

## 2. BooksController

**Rota base:** `/Books`  
**Autenticação:** Obrigatória (`[Authorize]`)

### Ações

---

#### `GET /Books` — `Index(search, categoryId, status, sort, pageNumber)`

**Descrição:** Lista paginada de livros com filtros.

**Parâmetros de busca:**
| Parâmetro | Tipo | Descrição |
|---|---|---|
| `search` | string | Busca por título, autor, ISBN ou CDD |
| `categoryId` | int? | Filtrar por categoria |
| `status` | ReadingStatus? | Filtrar por status de leitura |
| `sort` | string | Ordenação: `title`, `author`, `year`, `rating` ou padrão (data) |
| `pageNumber` | int | Página atual (padrão: 1) |

**Regra especial:** Se `status == 99`, o sistema interpreta como filtro de **"Emprestados"** (`isLoaned = true`) e não filtra por status.

**Tamanho da página:** Definido em `AppConstants.Pagination.DefaultPageSize`.

---

#### `GET /Books/SearchAutocomplete?query=` — `SearchAutocomplete(query)`

**Descrição:** Endpoint JSON para autocomplete de busca de livros.

**Retorna:** `[ { id, title, author, cover } ]`

---

#### `GET /Books/Details/{id}` — `Details(id)`

**Descrição:** Exibe detalhes completos do livro, incluindo categorias, histórico de leituras e empréstimos.

---

#### `GET /Books/Create` — `Create()`

**Descrição:** Exibe formulário de cadastro de livro.

---

#### `POST /Books/Create` — `Create(book, coverFile)`

**Descrição:** Cria um novo livro no tenant do usuário.

**Validações executadas em ordem:**
1. **Validação do modelo** (`ModelState.IsValid`)
2. **Limite de livros do plano** via `ITenantLimitService.ValidateBookLimitAsync()`
   - Se atingido: erro no `ModelState`, retorna formulário
3. **Validação do arquivo de capa** (se enviado):
   - Valida limite de armazenamento via `ValidateStorageLimitAsync(fileSize)`
   - Valida tipo/tamanho via `IFileUploadService.IsValidImageFile()` (JPG/PNG/WebP, máx. 5MB)
4. Salva a capa via `IFileUploadService.SaveCoverImageAsync()`
5. Define `CreatedAt = DateTime.Now`
6. Salva o livro via `IBookRepository.AddAsync()`

**Pós-criação (Gamificação):**
- Se `status == Read` e `Pages` foi informado → `RegisterReadingActivityAsync()` + `UpdateUserProgressAsync()`
- Caso contrário → apenas `UpdateUserProgressAsync()`

**Pós-criação (Cache):**
- Invalida o cache do dashboard: `Dashboard_Data_{tenantId}`

---

#### `GET /Books/Edit/{id}` — `Edit(id)`

**Descrição:** Carrega formulário de edição com dados do livro.

---

#### `POST /Books/Edit/{id}` — `Edit(id, book, coverFile)`

**Descrição:** Atualiza um livro existente.

**Validações:**
1. Verifica `id == book.Id` e `id > 0`
2. Sanitiza `Title` e `Author` com `.Trim()`
3. **Validação do modelo** (`ModelState.IsValid`)
4. Valida arquivo de capa se enviado (tipo + tamanho)

**Comportamento da capa:**
- Se nova capa enviada: apaga a capa antiga via `IFileUploadService.DeleteFile()` e salva a nova
- Se capa não enviada: mantém o caminho original

**Preservação de dados:**
- `CreatedAt` é preservado do registro original
- `TenantId` é preservado do registro original
- `RowVersion` é preservado para **controle de concorrência otimista**

**Gamificação pós-edição:**
- Se status mudou para `Read` (de outro status) e tem páginas → `RegisterReadingActivityAsync()` + `UpdateUserProgressAsync()`
- Se status mudou para outro estado → apenas `UpdateUserProgressAsync()`

**Tratamento de concorrência:**
- Captura `InvalidOperationException` com mensagem "modificado" → exibe mensagem específica de conflito

---

#### `GET /Books/Delete/{id}` — `Delete(id)`

**Descrição:** Exibe confirmação de exclusão com todos os detalhes do livro.

---

#### `POST /Books/Delete/{id}` — `DeleteConfirmed(id)`

**Descrição:** Exclui o livro e seus arquivos associados.

**Comportamento:**
1. Remove arquivo de capa via `IFileUploadService.DeleteFile()`
2. Remove o livro via `IBookRepository.DeleteAsync()`
3. Atualiza o `UserProgress` via `UpdateUserProgressAsync()`
4. Invalida o cache do dashboard

---

#### `POST /Books/UpdateStatus` — `UpdateStatus(id, status)`

**Descrição:** Atualização rápida de status via AJAX (sem recarregar a página).

**Retorna:** `{ success: true/false }`

**Gamificação:**
- Se novo status = `Read` e status anterior ≠ `Read` e tem páginas → `RegisterReadingActivityAsync()` + `UpdateUserProgressAsync()`
- Se qualquer outra mudança de status → `UpdateUserProgressAsync()`
- Cache do dashboard invalidado em qualquer caso

---

#### `GET /Books/ExportExcel` — `ExportExcel(search, categoryId, status, sort)`

**Descrição:** Exporta a lista de livros filtrada em formato **Excel (.xlsx)**.

**Restrição de plano:** `[RequirePlanFeature(PlanFeature.ExportData)]`  
→ Disponível apenas para planos **Premium** e **Pro**

**Arquivo gerado:** `BookLibrary_Livros_{yyyyMMdd_HHmmss}.xlsx`  
**Colunas:** ID, Título, Autor, ISBN, Editora, Ano, Páginas, Categoria, Status, Avaliação, CDD, Data Cadastro

---

#### `GET /Books/ExportPdf` — `ExportPdf(search, categoryId, status, sort)`

**Descrição:** Exporta a lista de livros filtrada em formato **PDF**.

**Restrição de plano:** `[RequirePlanFeature(PlanFeature.ExportData)]`  
→ Disponível apenas para planos **Premium** e **Pro**

---

## 3. CategoriesController

**Rota base:** `/api/categories`  
**Tipo:** `[ApiController]` (retorna JSON)  
**Autenticação:** Obrigatória (`[Authorize]`)

### Ações

---

#### `GET /api/categories` — `GetAll()`

**Descrição:** Lista todas as categorias do tenant atual.

---

#### `GET /api/categories/{id}` — `GetById(id)`

**Descrição:** Retorna uma categoria pelo ID.

**Retorna:** `404` se não encontrada.

---

#### `POST /api/categories` — `Create([FromBody] CategoryDto)`

**Descrição:** Cria uma nova categoria.

**Validações:**
- `Name` não pode ser vazio/nulo → `400 Bad Request`
- `Name` é sanitizado com `.Trim()`

**Defaults aplicados automaticamente:**
- `Color` → `#0d6efd` (azul padrão) se não informado
- `Icon` → `fa-book` se não informado
- `TenantId` é preenchido automaticamente pelo serviço

---

#### `PUT /api/categories/{id}` — `Update(id, CategoryDto)`

**Descrição:** Atualiza nome, cor e ícone de uma categoria.

**Regras:**
- `Name` não pode ser vazio → `400 Bad Request`
- Se `Color` ou `Icon` não informados, mantém os valores atuais

---

#### `DELETE /api/categories/{id}` — `Delete(id)`

**Descrição:** Remove uma categoria.

**Regra:** Livros associados à categoria têm `CategoryId` definido como `null` (comportamento `ON DELETE SET NULL` no banco).

---

## 4. ReadingController

**Rota base:** `/Reading`  
**Autenticação:** Obrigatória (`[Authorize]`)

### Ações

---

#### `GET /Reading` — `Index()`

**Descrição:** Lista todas as leituras **em andamento** (sem `EndDate`).

**Query:** `ReadingProgresses` com `EndDate == null`, ordenados por `CreatedAt DESC`, incluindo `Book.Category`.

---

#### `GET /Reading/Create?bookId=` — `Create(bookId?)`

**Descrição:** Formulário para registrar nova leitura.  
Pré-seleciona o livro se `bookId` for passado. Define `StartDate = DateTime.Today`.

---

#### `POST /Reading/Create` — `Create(ReadingProgress)`

**Descrição:** Cria ou atualiza um progresso de leitura.

**Validações:**
1. Verifica limite de notas pelo plano via `IPlanFeatureService.GetMaxNotesLengthAsync()`
   - Se ultrapassado: erro no `ModelState` informando o plano atual e o limite

**Comportamento (criar vs. atualizar):**
- Se `rp.Id > 0`: **atualiza** o registro existente (busca por `FindAsync` e atualiza campos)
- Se `rp.Id == 0`: **cria** novo registro

**Regras sobre o Status do Livro:**
- Se `EndDate` preenchido → livro marcado como `Read`
- Se `EndDate` nulo → livro marcado como `Reading`
- Se `Rating > 0` → atualiza também o `Rating` no livro

**Gamificação:**
- Leitura concluída (`EndDate` preenchido, livro não estava `Read`, tem páginas) → `RegisterReadingActivityAsync(pages)` + `UpdateUserProgressAsync()`
- Leitura em andamento (`CurrentPage > 0`) → `RegisterReadingActivityAsync(currentPage)` + `UpdateUserProgressAsync()`
- Cache do dashboard invalidado

**Ordem crítica de operações:**
1. `SaveChangesAsync()` (salva ReadingProgress + status do livro)
2. `UpdateUserProgressAsync()` (usa dados já salvos)

**Redirecionamento:** Se veio da página de detalhes de livro (`/Books/Details/`), redireciona de volta para lá.

---

#### `GET /Reading/GetLatestReading?bookId=` — `GetLatestReading(bookId)`

**Descrição:** Endpoint JSON. Retorna o último `ReadingProgress` de um livro específico.

**Retorna:**
```json
{
  "success": true,
  "data": { "id", "startDate", "endDate", "currentPage", "rating", "isReread", "notes" }
}
```

---

#### `POST /Reading/UpdatePage` — `UpdatePage(id, currentPage)`

**Descrição:** Atualização rápida de página atual via AJAX.

**Retorna:** `{ success: true/false, percent: N, changes: N }`

**Regras automáticas:**
- Se `currentPage >= book.Pages` → marca leitura como **concluída** (`EndDate = DateTime.Today`, `book.Status = Read`) e registra atividade de gamificação
- Se `currentPage > oldPage` → registra as páginas adicionais como atividade de leitura
- Sempre: `UpdateUserProgressAsync()` + invalidação do cache

---

#### `POST /Reading/Delete/{id}` — `Delete(id)`

**Descrição:** Remove um registro de progresso de leitura.

**Comportamento:**
- Remove o registro
- Chama `UpdateUserProgressAsync()` para recalcular stats
- Invalida cache do dashboard

---

## 5. ShelfController

**Rota base:** `/Shelf`  
**Autenticação:** Obrigatória (`[Authorize]`)  
**Cache:** `[ResponseCache(Duration = 180)]` — 3 minutos, variado por `filter`

### Ações

---

#### `GET /Shelf?filter=` — `Index(filter?)`

**Descrição:** Exibe todos os livros em formato de **estante visual** com filtro de status.

**Filtros suportados (query string `filter`):**
| Valor | Comportamento |
|---|---|
| `reading` | Livros com status `Reading` |
| `read` | Livros com status `Read` |
| `wanttoread` | Livros com status `WantToRead` |
| `paused` | Livros com status `Paused` |
| `loaned` | Livros com empréstimos ativos (`isLoaned = true`) |
| (vazio) | Todos os livros |

Sempre ordena por título (`sort = "title"`).  
`ViewBag.Total` = total de livros retornados.

---

## 6. GamificationController

**Rota base:** `/Gamification`  
**Autenticação:** Obrigatória (`[Authorize]`)

### Ações

---

#### `GET /Gamification` — `Index()`

**Descrição:** Exibe o painel de gamificação do usuário.

**Dados carregados:**
| Dado | Origem |
|---|---|
| `userProgress` | `GetOrCreateUserProgressAsync()` |
| `achievements` | `GetAllAchievementsAsync()` |
| `userAchievements` | `GetUserAchievementsAsync()` |
| `stats` | `GetUserStatsAsync()` |

**Limite de conquistas por plano:**
- Obtém `maxAchievements` via `IPlanFeatureService.GetMaxAchievementsVisibleAsync()`
- Conquistas são divididas em: **visíveis** (até o limite) e **bloqueadas** (excedente — passado para `ViewBag.LockedAchievements`)
- `ViewBag.IsLimited = true` quando existem conquistas ocultas

**Cache:** Headers de `no-cache` para evitar cache do navegador.

---

#### `POST /Gamification/UpdateProgress` — `UpdateProgress()`

**Descrição:** Força recalculação completa de progresso e pontos.

**Comportamento:**
- Chama `UpdateProgressWithRecalculationAsync()` (recalcula tudo do zero)
- Invalida cache do dashboard
- Exibe mensagem de sucesso ou erro

---

#### `GET /Gamification/DiagnosticProgress` — `DiagnosticProgress()`

**Descrição:** Endpoint de diagnóstico retornando JSON com estado completo do `UserProgress` e `UserStats`.

---

## 7. StatisticsController

**Rota base:** `/Statistics`  
**Autenticação:** Obrigatória (`[Authorize]`)  
**Restrição de plano:** `[RequirePlanFeature(PlanFeature.AdvancedStats)]` → Apenas **Pro** e **MasterAdmin**

### Ações

---

#### `GET /Statistics` — `Index()`

**Descrição:** Exibe painel de estatísticas avançadas.

**Dados carregados:**
| Propriedade do ViewModel | Descrição |
|---|---|
| `UserStats` | Stats gerais (books, pages, streak, etc.) |
| `MonthlyReadingData` | Livros lidos por mês no ano atual |
| `ReadingByCategory` | Top 10 categorias de livros lidos |
| `ReadingByAuthor` | Top 10 autores de livros lidos |
| `ReadingTrendData` | Tendência dos últimos 12 meses |
| `YearlyComparison` | Comparação do ano atual vs. anterior |
| `ReadingVelocity` | Velocidade média de leitura (páginas/dia) |
| `TopRatedBooks` | Top 10 livros mais bem avaliados |
| `SocialComparison` | Comparação com outros usuários do sistema |
| `GlobalLeaderboard` | Top 10 do ranking global |

**Cache:** `no-store` — nunca cacheado.

---

#### `GET /Statistics/ShareCard?type=` — `ShareCard(type)`

**Descrição:** Gera card de compartilhamento de estatísticas (para redes sociais).

**Tipos disponíveis:** `summary`, `books`, `streak`, etc.

**Dados do card:** `UserName`, `Level`, `TotalPoints`, `BooksRead`, `TotalPages`, `CurrentStreak`, `AverageRating`, `FavoriteCategory`

---

## 8. GoogleBooksController

**Rota base:** `/GoogleBooks`  
**Autenticação:** Obrigatória (`[Authorize]`)  
**Restrição de plano:** `[RequirePlanFeature(PlanFeature.GoogleBooksApi)]` → Apenas **Premium** e **Pro**

### Ações

---

#### `GET /GoogleBooks/Import` — `Import()`

**Descrição:** Página de importação de livros do Google Books.

---

#### `GET /GoogleBooks/Search?query=` — `Search(query)`

**Descrição:** Busca livros na API do Google Books. Retorna JSON.

**Regras:**
- `query` não pode ser vazia → `400 Bad Request`
- Máximo de **40 resultados** por busca
- Se a query contém `intitle:"..."` → aplica filtro adicional para retornar apenas livros cujo título contenha o texto exato
- Se nenhum resultado: `404 Not Found`

---

#### `POST /GoogleBooks/EnrichBook/{id}` — `EnrichBook(id)`

**Descrição:** Enriquece os dados de um livro já existente na biblioteca com dados do Google Books.

**Comportamento:**
- Busca o livro localmente pelo `id`
- Chama `IGoogleBooksService.EnrichBookDataAsync(book)` para preencher campos faltantes
- Salva as atualizações via `IBookRepository.UpdateAsync()`
- Invalida cache do dashboard
- Retorna `{ message, book }` em caso de sucesso

**Nota:** `[IgnoreAntiforgeryToken]` — pode ser chamado via fetch/axios sem token CSRF.

---

#### `POST /GoogleBooks/ImportFromGoogle` — `ImportFromGoogle([FromBody] ImportFromGoogleRequest)`

**Descrição:** Importa um livro específico do Google Books para a biblioteca do usuário.

**Request body:** `{ googleBookId: string, categoryId: int? }`

**Validações:**
1. `request` não pode ser `null` → `400`
2. `googleBookId` não pode ser vazio → `400`
3. Chama `CreateBookFromGoogleBooksAsync(googleBookId)` — se retornar `null` → `400` com detalhes do erro
4. **Verifica duplicidade por ISBN:** se livro já existir → `409 Conflict` com dados do livro existente

**Comportamento pós-importação:**
- Aplica `categoryId` se fornecido
- Salva via `IBookRepository.AddAsync()`
- Invalida cache do dashboard
- Retorna `{ message, book }`

---

## 9. BillingController

**Rota base:** `/billing`  
**Autenticação:** Obrigatória (exceto webhook)

### Ações

---

#### `GET /billing` — `Index(checkoutSuccess?)`

**Descrição:** Portal de cobrança e assinatura do usuário.

**Comportamento quando `checkoutSuccess = true`:**
- Aguarda até **10 segundos** (em etapas: 5s + 3s + 2s) para o Stripe processar o checkout
- Tenta processar o checkout via `ProcessCheckoutCompletedManuallyAsync()`
- Fallback para `SyncSubscriptionStatusAsync()` se o primeiro falhar
- Após sucesso: **renova os claims de autenticação** via `RefreshAuthenticationClaimsAsync()` e redireciona para `Index`

**Comportamento normal:**
- Sincroniza status da assinatura via `SyncSubscriptionStatusAsync()`
- Detecta inconsistência entre `tenant.Plan` e `subscription.Plan` (loga warning)
- Carrega histórico de pagamentos e valor da próxima fatura

---

#### `GET /billing/upgrade` — `Upgrade()`

**Descrição:** Exibe página de escolha de planos para upgrade.

---

#### `POST /billing/upgrade` — `ProcessUpgrade(plan)`

**Descrição:** Processa o upgrade de plano.

**Validações:**
- Plano inválido → `TempData["Error"]`
- Tentativa de downgrade direto para `Free` → mensagem de erro (deve cancelar assinatura)

**Fluxo para nova assinatura:**
1. Se assinatura existente está `Cancelled` ou `Expired` → arquiva via `ArchiveCancelledSubscriptionAsync()`
2. Cria sessão de checkout no Stripe via `CreateCheckoutSessionAsync()`
3. Redireciona para URL de checkout do Stripe

**Fluxo para upgrade de assinatura ativa:**
1. Chama `UpdateSubscriptionPlanAsync()` (atualiza plano no Stripe com proração)
2. Renova os claims de autenticação
3. Mensagem diferenciada para: trial ativo, upgrade normal

**Exceções tratadas:**
- `InvalidOperationException` → mensagem de negócio
- `StripeException` → mensagem de erro do Stripe
- `Exception` genérica → mensagem genérica com detalhes

---

#### `POST /billing/cancel` — `CancelSubscription(immediately?)`

**Descrição:** Cancela a assinatura do usuário.

**Modos:**
- `immediately = false` (padrão): cancela no fim do período atual
- `immediately = true`: cancela imediatamente

---

#### `POST /billing/reactivate` — `ReactivateSubscription()`

**Descrição:** Reativa uma assinatura que estava marcada para cancelamento (mas ainda no período ativo).

---

#### `GET /billing/portal` — `CustomerPortal()`

**Descrição:** Redireciona para o **Portal de Cliente do Stripe** (gerenciamento de cartão, faturas, etc.).

---

#### `POST /webhook/stripe` — `StripeWebhook()`

**Descrição:** Endpoint público para receber eventos do Stripe.

**Segurança:** `[AllowAnonymous]` — valida a assinatura do webhook via `Stripe-Signature` header  
**Chave usada:** `Stripe:WebhookSecret` do `appsettings.json`  
**Processa via:** `IPaymentService.ProcessWebhookAsync(json, signature)`

---

#### `GET /billing/subscription-issue` — `SubscriptionIssue(status?)`

**Descrição:** Página exibida quando há problema com a assinatura.

---

#### `GET /billing/expired` — `Expired()`

**Descrição:** Página exibida quando a assinatura expirou.

---

## 10. TenantController

**Rota base:** `/Tenant`  
**Autenticação:** Obrigatória (`[Authorize]`)

### Ações

---

#### `GET /Tenant/Usage` — `Usage()`

**Descrição:** Exibe o painel de **uso atual da biblioteca** do usuário (livros, armazenamento, features do plano).

**Dados exibidos:**
| Campo | Descrição |
|---|---|
| `TenantId` / `TenantName` | Identificação da biblioteca |
| `Plan` | Plano atual (Free/Premium/Pro) |
| `MaxBooks` / `CurrentBooks` / `BooksPercentage` | Uso de livros |
| `MaxStorageMB` / `CurrentStorageMB` / `StoragePercentage` | Uso de armazenamento |
| `MonthlyPrice` | Preço mensal do plano |
| `Features` | Lista de features disponíveis/indisponíveis no plano |

**Origem dos limites:** `TenantPlanLimits.GetLimits(plan)` — helper estático

---

## 11. TenantSetupController

**Rota base:** `/TenantSetup`

### Ações

| Ação | Rota | Descrição |
|---|---|---|
| `Setup()` | `GET /TenantSetup/Setup` | Redireciona para `Onboarding/Start` |
| `Index()` | `GET /TenantSetup/Index` | Página de configuração de organização |
| `Choose()` | `GET /TenantSetup/Choose` | Seleção: criar nova org ou entrar em existente |
| `CreateOrganization()` | `GET /TenantSetup/CreateOrganization` | Formulário de nova organização |
| `JoinOrganization(inviteCode?)` | `GET /TenantSetup/JoinOrganization` | Formulário para aceitar convite |

---

## 12. Admin / AdminController

**Rota base:** `/Admin`  
**Area:** `Admin`  
**Autenticação:** Obrigatória + verificação manual de `IsMasterAdmin`

### Ações

---

#### `GET /Admin` — `Index()`

**Descrição:** Dashboard global do administrador master.

**Verificação de acesso:**
- Busca o usuário pelo `ClaimTypes.NameIdentifier`
- Verifica `user.IsMasterAdmin == true`
- Se não for admin: redireciona para `/Home/Index`

**Dados do ViewModel `AdminDashboardViewModel`:**
| Campo | Descrição |
|---|---|
| `TotalTenants` | Total de tenants (bibliotecas) no sistema |
| `ActiveTenants` | Tenants com `IsActive = true` |
| `TotalUsers` | Total de usuários registrados |
| `TotalBooks` | Total de livros em todo o sistema |
| `RecentTenants` | Últimos 10 tenants criados com owner e contagem de livros |
| `TenantsByPlan` | Agrupamento de tenants por plano (Free/Premium/Pro) |

---

## 13. Admin / TenantsController

**Rota base:** `/Admin/Tenants`  
**Area:** `Admin`  
**Autenticação:** Obrigatória + verificação `IsAdminAsync()` em **todas** as ações

### Ações

---

#### `GET /Admin/Tenants` — `Index(search?, plan?, active?)`

**Descrição:** Lista todos os tenants com filtros.

**Filtros:**
- `search`: por nome do tenant ou e-mail do proprietário
- `plan`: por plano (`Free`, `Premium`, `Pro`, `MasterAdmin`)
- `active`: por status ativo/inativo

**Ordenação:** por `CreatedAt` decrescente

---

#### `GET /Admin/Tenants/Details/{id}` — `Details(id)`

**Descrição:** Detalhes de um tenant específico, incluindo estatísticas (livros e categorias).

---

#### `GET /Admin/Tenants/Create` — `Create()`

**Descrição:** Formulário de criação de tenant pelo admin.

---

#### `POST /Admin/Tenants/Create` — `Create(TenantCreateViewModel)`

**Descrição:** Cria um novo tenant diretamente (sem usuário associado inicialmente).

---

#### `GET /Admin/Tenants/Edit/{id}` — `Edit(id)`

**Descrição:** Formulário de edição de tenant.

---

#### `POST /Admin/Tenants/Edit/{id}` — `Edit(id, TenantEditViewModel)`

**Descrição:** Atualiza dados do tenant: nome, plano, status ativo, limites de livros/armazenamento e data de expiração.

---

#### `GET /Admin/Tenants/Delete/{id}` — `Delete(id)`

**Descrição:** Confirmação de exclusão de tenant.

**Regra:** Tenants com plano `MasterAdmin` **não podem ser excluídos** — exibe erro e redireciona.

---

#### `POST /Admin/Tenants/Delete/{id}` — `DeleteConfirmed(id)`

**Descrição:** Exclui um tenant e **todos os seus dados associados** em uma única transação.

**Proteções:**
- Bloqueia exclusão do tenant `MasterAdmin`
- Executa tudo dentro de uma **transação de banco de dados**

**Ordem de exclusão (para evitar violações de FK):**
1. `ReadingActivities` do tenant
2. `UserAchievements` do tenant
3. `UserProgresses` do tenant
4. `ReadingProgresses` do tenant
5. `Loans` do tenant
6. `Books` do tenant
7. `Categories` do tenant
8. `Subscriptions` do tenant
9. `Payments` do tenant
10. `BillingAddresses` do tenant
11. Usuário proprietário (se existir)
12. Tenant em si

---

## 14. Serviços

### 14.1 GamificationService

**Interface:** `IGamificationService`

---

#### `GetOrCreateUserProgressAsync(userId?)`

**Descrição:** Busca ou cria o `UserProgress` do usuário.

**Regras:**
- Usa `IgnoreQueryFilters()` — busca por `UserId`, não por `TenantId`
- **Tratamento de Race Condition:** se dois threads tentarem criar simultaneamente (violação de UNIQUE constraint — SQL Server error 2627 ou 2601), o segundo aguarda 50ms e retenta a busca

---

#### `UpdateUserProgressAsync(userId?)`

**Descrição:** Recalcula e salva o progresso do usuário no banco.

**O que é calculado:**
| Campo | Lógica |
|---|---|
| `BooksRead` | `COUNT(books WHERE status = 'Read')` |
| `TotalPagesRead` | `SUM(pages of Read books) + SUM(currentPage of active readings)` |
| `ReviewsCount` | `COUNT(readingProgresses WHERE notes != null OR rating > 0)` |
| `Level` | `(TotalPoints / 100) + 1` |

**Após atualizar:** chama `CheckAndUnlockAchievementsAsync()`

---

#### `CheckAndUnlockAchievementsAsync(userId?)`

**Descrição:** Verifica quais conquistas o usuário acabou de desbloquear e adiciona os pontos.

**Critérios de verificação por tipo:**
| Tipo | Critério |
|---|---|
| `BooksRead` | `userProgress.BooksRead >= achievement.Requirement` |
| `BooksInLibrary` | `COUNT(books) >= requirement` |
| `ReadingStreak` | `userProgress.CurrentStreak >= requirement` |
| `PagesRead` | `userProgress.TotalPagesRead >= requirement` |
| `GenreExplorer` | `COUNT(DISTINCT categoryId WHERE status=Read) >= requirement` |
| `Reviewer` | `userProgress.ReviewsCount >= requirement` |
| `YearlyGoal` | `userProgress.YearlyGoalPercent >= requirement` |

**Pós-desbloqueio:**
- Adiciona pontos ao `TotalPoints`
- Recalcula `Level`
- Salva `UserAchievement` no banco

---

#### `RegisterReadingActivityAsync(bookId?, pagesRead, userId?)`

**Descrição:** Registra ou acumula atividade de leitura para o dia atual.

**Regra:** Se já existe `ReadingActivity` para hoje → **acumula** as páginas (sem criar novo registro).  
Se não existe → cria novo `ReadingActivity`.

**Após registrar:** chama `UpdateStreakAsync()`

---

#### `UpdateStreakAsync(userId?)`

**Descrição:** Recalcula o streak (dias consecutivos de leitura).

**Algoritmo:**
1. Busca todas as datas com atividade, ordenadas decrescentemente
2. Se a data mais recente for anterior a **ontem** → `CurrentStreak = 0`
3. Se for ontem ou hoje → conta dias consecutivos iterando as datas (diferença de 1 dia entre cada)
4. Atualiza `LongestStreak` se o streak atual for maior

---

#### `UpdateProgressWithRecalculationAsync(userId?)`

**Descrição:** Recalculação **completa** do progresso (usado no botão manual da página de Gamificação).

Chama `UpdateUserProgressAsync()` após limpar o `ChangeTracker`.

---

#### `GetUserStatsAsync(userId?)`

**Descrição:** Retorna um `Dictionary<string, object>` com todas as estatísticas do usuário.

**Dados retornados:**
```
BooksRead, BooksReading, BooksWantToRead, TotalBooks, TotalPagesRead,
AverageRating, FavoriteCategory, CurrentStreak, LongestStreak,
Level, TotalPoints, ReviewsCount, YearlyGoal, YearlyGoalPercent
```

---

### 14.2 TenantLimitService

**Interface:** `ITenantLimitService`

---

#### `ValidateBookLimitAsync()`

**Descrição:** Verifica se o tenant atingiu o limite de livros do seu plano.

**Retorna:** `(bool success, string message)`

**Lógica:**
1. Busca o tenant pelo `TenantId` atual
2. Obtém a contagem atual de livros
3. Obtém `maxBooks` via `TenantPlanLimits.GetLimits(tenant.Plan)`
4. Se `currentBooks >= maxBooks` → retorna `(false, mensagem com sugestão de upgrade)`

---

#### `ValidateStorageLimitAsync(fileSizeBytes)`

**Descrição:** Verifica se há espaço em disco suficiente para o arquivo enviado.

**Lógica:**
1. Calcula armazenamento atual varrendo os arquivos de capa no disco (`wwwroot/uploads/covers/`)
2. Converte `fileSizeBytes` para MB
3. Se `currentStorageMB + fileSizeMB > maxStorageMB` → retorna erro com uso atual

---

#### `GetCurrentStorageUsageMBAsync()`

**Descrição:** Calcula o armazenamento atual em MB lendo os arquivos físicos no servidor.

**Nota:** Lê os caminhos de capa do banco, depois acessa o sistema de arquivos para somar os tamanhos reais.

---

### 14.3 PlanFeatureService

**Interface:** `IPlanFeatureService`

Centraliza as verificações de funcionalidades disponíveis por plano.

| Método | Planos com Acesso |
|---|---|
| `CanExportDataAsync()` | Premium, Pro, MasterAdmin |
| `CanUseGoogleBooksApiAsync()` | Premium, Pro, MasterAdmin |
| `CanUseAdvancedStatsAsync()` | Pro, MasterAdmin |
| `GetMaxAchievementsVisibleAsync()` | Free=5, Premium=∞, Pro=∞ |
| `GetMaxNotesLengthAsync()` | Free=500, Premium=3000, Pro=3000 |
| `GetMaxReadingHistoryVisibleAsync()` | Free=10, Premium=∞, Pro=∞ |
| `CanViewStreakHistoryAsync()` | Free=❌, Premium=✅, Pro=✅ |

#### `GetUpgradeMessageAsync(featureName)`

Retorna HTML formatado com link para `/billing/upgrade` informando o plano atual e a feature bloqueada.

---

### 14.4 PaymentService

**Interface:** `IPaymentService`  
**Provider:** Stripe

#### Principais métodos:

| Método | Descrição |
|---|---|
| `CreateCustomerAsync(tenant, email)` | Cria cliente no Stripe e salva `StripeCustomerId` no tenant |
| `CreateSubscriptionAsync(tenantId, plan)` | Cria assinatura no Stripe com plano e trial opcional |
| `CreateCheckoutSessionAsync(tenantId, plan, successUrl, cancelUrl)` | Cria sessão de checkout Stripe (para novas assinaturas) |
| `UpdateSubscriptionPlanAsync(tenantId, plan)` | Faz upgrade/downgrade da assinatura com proração |
| `CancelSubscriptionAsync(tenantId, immediately)` | Cancela assinatura imediatamente ou no fim do período |
| `ReactivateSubscriptionAsync(tenantId)` | Remove cancelamento agendado |
| `ArchiveCancelledSubscriptionAsync(tenantId)` | Arquiva assinatura cancelada/expirada para permitir nova |
| `SyncSubscriptionStatusAsync(tenantId)` | Sincroniza status da assinatura do Stripe para o banco local |
| `ProcessCheckoutCompletedManuallyAsync(tenantId)` | Processa checkout completado (fallback para webhook) |
| `ProcessWebhookAsync(json, signature)` | Processa eventos do Stripe (webhook) |
| `GetPaymentHistoryAsync(tenantId)` | Lista histórico de pagamentos |
| `GetUpcomingInvoiceAmountAsync(tenantId)` | Valor da próxima fatura |
| `GetCustomerPortalUrlAsync(tenantId, returnUrl)` | URL do portal do cliente Stripe |

**Price IDs do Stripe:** Mapeados internamente por plano via `GetStripePriceId(plan)`.

---

### 14.5 GoogleBooksService

**Interface:** `IGoogleBooksService`  
**Base URL:** `https://www.googleapis.com/books/v1/`

| Método | Descrição |
|---|---|
| `SearchBooksByQueryAsync(query)` | Busca por texto livre (máx. 40 resultados) |
| `SearchBooksByIsbnAsync(isbn)` | Busca por ISBN (normaliza hifens e espaços) |
| `GetBookByIdAsync(googleBookId)` | Busca volume específico por ID do Google |
| `EnrichBookDataAsync(book)` | Preenche campos faltantes de um livro já existente |
| `CreateBookFromGoogleBooksAsync(googleBookId)` | Cria objeto `Book` completo a partir de dados do Google |

**API Key:** Opcional — sem chave: 1.000 req/dia; com chave: limite maior.

**`CreateBookFromGoogleBooksAsync`** mapeia:
- `Title`, `Author` (Authors joined por ", "), `Publisher`, `PublishYear`
- `Pages`, `ISBN` (preferência ISBN-13 > ISBN-10), `Language`
- `Synopsis` (description), `CoverImagePath` (thumbnail URL)
- **Categoria automática:** busca categoria existente pelo nome ou usa a primeira disponível do tenant

---

### 14.6 ExportService

**Interface:** `IExportService`

#### `ExportBooksToExcel(books)` → `byte[]`

- Usa **ClosedXML** para gerar arquivo `.xlsx`
- Cabeçalho formatado em negrito com fundo azul claro
- 12 colunas: ID, Título, Autor, ISBN, Editora, Ano, Páginas, Categoria, Status, Avaliação, CDD, Data Cadastro
- Auto-ajuste de largura de colunas

#### `ExportBooksToPdf(books)` → `byte[]`

- Usa **QuestPDF** (licença Community) para gerar arquivo `.pdf`
- Formato A4 com margem de 2cm
- Tabela com 5 colunas: Título, Autor, Categoria, Status, Nota
- Cabeçalho e rodapé com número de páginas
- Inclui total de livros e data de geração

---

### 14.7 BackgroundJobService

**Interface:** `IBackgroundJobService`  
**Framework:** Hangfire

| Método | Descrição |
|---|---|
| `GenerateDailyReport()` | Geração de relatório diário (a implementar) |
| `CleanupOldCovers()` | Remove arquivos de capa com mais de 365 dias sem acesso |
| `BackupDatabase()` | Copia o arquivo `.db` para pasta `Backups/` com timestamp. Mantém apenas os últimos 7 dias |
| `EnrichBooksFromGoogleBooksAsync()` | Enriquece livros da biblioteca usando Google Books API |

---

## 15. Repositórios

### 15.1 BookRepository

**Interface:** `IBookRepository`

| Método | Descrição |
|---|---|
| `GetAllAsync()` | Todos os livros com categoria |
| `GetByIdAsync(id)` | Por ID simples |
| `GetByIdWithDetailsAsync(id)` | Com Categoria, ReadingProgresses e Loans |
| `GetByIsbnAsync(isbn)` | Por ISBN (normaliza hifens e espaços) |
| `GetFilteredBooksAsync(search, categoryId, status, sort, isLoaned?)` | Lista filtrada completa |
| `GetFilteredBooksPaginatedAsync(...)` | Lista filtrada com paginação (retorna `PaginatedList<Book>`) |
| `SearchBooksAutocompleteAsync(query)` | Busca rápida por título/autor para autocomplete |
| `AddAsync(book)` | Cria livro |
| `UpdateAsync(book)` | Atualiza livro |
| `DeleteAsync(id)` | Remove livro |
| `ExistsAsync(id)` | Verifica existência |
| `CountAsync()` | Contagem total |
| `GetDashboardStatsAsync()` | Stats agregados para o dashboard |
| `GetRecentBooksAsync(count)` | Últimos N livros adicionados |
| `GetFeaturedBooksAsync(count)` | Livros com `IsFeatured = true` |
| `GetCurrentlyReadingAsync()` | Livros com status `Reading` |
| `GetCategoryStatsAsync()` | Contagem de livros por categoria |
| `GetTopRatedAsync(count)` | Top N livros por avaliação |

**Filtros de busca** em `GetFilteredBooksAsync`:
- Texto: `LIKE %search%` em `Title`, `Author`, `ISBN`, `CDD`
- Categoria: `WHERE categoryId = X`
- Status: `WHERE status = X`
- Emprestados: `WHERE Loans.Any(l => !l.IsReturned)`
- Ordenação: `title`, `author`, `year`, `rating`, ou padrão (`createdAt DESC`)

---

### 15.2 CategoryRepository

**Interface:** `ICategoryRepository`

| Método | Descrição |
|---|---|
| `GetAllAsync()` | Todas as categorias do tenant |
| `GetByIdAsync(id)` | Por ID |
| `AddAsync(category)` | Cria categoria |
| `UpdateAsync(category)` | Atualiza categoria |
| `DeleteAsync(id)` | Remove categoria |

---

## 16. Middleware

### 16.1 TenantResolverMiddleware

**Posição no pipeline:** Executado em toda requisição.

**Comportamento:**
1. Chama `ITenantService.ResolveTenantIdAsync()` para identificar a biblioteca do usuário autenticado
2. Se encontrado: preenche `HttpContext.Items["TenantId"]` e `HttpContext.Items["TenantName"]`
3. Se não encontrado ou erro: apenas loga e continua o pipeline (não bloqueia)

**Extensão:** `app.UseTenantResolver()` registrado em `Program.cs`

---

### 16.2 TenantSaveChangesInterceptor

**Tipo:** `SaveChangesInterceptor` do Entity Framework Core

**Comportamento:**
- Intercepta **toda operação de `SaveChanges`** no `AppDbContext`
- Para entidades novas (`EntityState.Added`) que possuem propriedade `TenantId` vazia/nula → preenche automaticamente com o `TenantId` do usuário atual
- Garante que nenhuma entidade seja salva sem `TenantId`

---

## 17. Filtros (Attributes)

### 17.1 RequirePlanFeatureAttribute

**Uso:** `[RequirePlanFeature(PlanFeature.X, "Nome da Feature")]`  
**Tipo:** `IAsyncActionFilter`

**Features controláveis:**
| Enum | Feature | Planos com Acesso |
|---|---|---|
| `PlanFeature.ExportData` | Exportação de dados | Premium, Pro, MasterAdmin |
| `PlanFeature.GoogleBooksApi` | Integração Google Books | Premium, Pro, MasterAdmin |
| `PlanFeature.AdvancedStats` | Estatísticas avançadas | Pro, MasterAdmin |

**Comportamento quando acesso negado:**
- **Requisição AJAX** (`X-Requested-With: XMLHttpRequest` ou `Accept: application/json`):
  - Retorna `403 JSON` com `{ success: false, message, requiresUpgrade: true, upgradeUrl: "/Billing/Upgrade" }`
- **Requisição normal:**
  - Define `TempData["Error"]` com mensagem formatada em HTML
  - Redireciona para `Billing/Upgrade`

---

### 17.2 ValidateTenantAttribute

**Uso:** `[ValidateTenant]`  
**Tipo:** `IAsyncActionFilter` (via `TypeFilterAttribute`)

**Verificações executadas:**
1. **TenantId presente** no `HttpContext.Items` → se ausente: redireciona para `Tenant/Setup`
2. **Tenant existe** no banco → se ausente: redireciona para `Home/NotFound`
3. **Tenant está ativo** (`IsActive = true`) → se inativo: exibe view `TenantInactive`
4. **Tenant não expirou** (`ExpiresAt < UtcNow`) → se expirado: redireciona para `Billing/Expired`
5. **Assinatura válida** → verifica status da subscription (se houver)

---

## Resumo: Mapa de Restrições por Plano

| Funcionalidade | Free | Premium | Pro | MasterAdmin |
|---|---|---|---|---|
| Livros | 25 | 100 | Ilimitado | Ilimitado |
| Armazenamento | 25 MB | 100 MB | 5 GB | Ilimitado |
| Exportação (Excel/PDF) | ❌ | ✅ | ✅ | ✅ |
| Google Books Import | ❌ | ✅ | ✅ | ✅ |
| Estatísticas Avançadas | ❌ | ❌ | ✅ | ✅ |
| Conquistas visíveis | 5 | Todas | Todas | Todas |
| Histórico de leitura | 10 registros | Ilimitado | Ilimitado | Ilimitado |
| Tamanho das notas | 500 chars | 3.000 chars | 3.000 chars | Ilimitado |
| Histórico de streak | ❌ | ✅ | ✅ | ✅ |
| Painel Admin | ❌ | ❌ | ❌ | ✅ |
| Preço mensal | R$ 0 | R$ 9,90 | R$ 19,90 | R$ 0 |
| Trial | — | 7 dias | 14 dias | — |
