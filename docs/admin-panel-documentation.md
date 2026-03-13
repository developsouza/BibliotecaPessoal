# Documentação do Painel Admin — BookLibrary

> Documentação técnica completa para replicar o painel administrativo em **Node.js + Express (API REST)** com **React (frontend)**.

---

## Sumário

1. [Visão Geral](#1-visão-geral)
2. [Regras de Negócio](#2-regras-de-negócio)
3. [Modelos de Dados](#3-modelos-de-dados)
4. [Enum: TenantPlan](#4-enum-tenantplan)
5. [Endpoints da API (Express)](#5-endpoints-da-api-express)
   - [Admin Dashboard](#51-admin-dashboard)
   - [Tenants — Listar](#52-tenants--listar)
   - [Tenants — Detalhes](#53-tenants--detalhes)
   - [Tenants — Criar](#54-tenants--criar)
   - [Tenants — Editar](#55-tenants--editar)
   - [Tenants — Ativar/Desativar](#56-tenants--ativardesativar)
   - [Tenants — Deletar](#57-tenants--deletar)
6. [Middlewares Necessários](#6-middlewares-necessários)
7. [Telas React](#7-telas-react)
   - [Dashboard](#71-dashboard)
   - [Lista de Tenants](#72-lista-de-tenants)
   - [Detalhes do Tenant](#73-detalhes-do-tenant)
   - [Criar Tenant](#74-criar-tenant)
   - [Editar Tenant](#75-editar-tenant)
   - [Deletar Tenant](#76-deletar-tenant)
8. [Estrutura de Pastas Sugerida](#8-estrutura-de-pastas-sugerida)
9. [Validações](#9-validações)
10. [Observações Gerais](#10-observações-gerais)

---

## 1. Visão Geral

O painel admin é uma área restrita acessível **apenas por usuários com `isMasterAdmin = true`**. Ele gerencia o sistema multi-tenant, onde cada **Tenant** representa a biblioteca pessoal de um usuário (modelo B2C — 1 usuário : 1 biblioteca).

**Principais funcionalidades:**
- Visualizar estatísticas globais do sistema (tenants, usuários, livros)
- CRUD completo de Tenants (bibliotecas)
- Ativar/Desativar bibliotecas
- Visualizar distribuição de planos
- Deletar tenant com todos os dados em cascata

---

## 2. Regras de Negócio

| Regra | Descrição |
|---|---|
| **Acesso restrito** | Toda rota admin verifica `user.isMasterAdmin === true`. Caso contrário, redireciona para home. |
| **Tenant MasterAdmin protegido** | Tenants com `plan = 99 (MasterAdmin)` **não podem ser deletados nem desativados**. |
| **Deleção em cascata** | Ao deletar um tenant, deve-se remover na ordem: ReadingActivities → UserAchievements → UserProgresses → ReadingProgresses → Books → Categories → Payments → Subscription → BillingAddress → Owner (User) → Tenant. |
| **Toggle de status** | Um tenant ativo pode ser desativado e vice-versa, exceto o MasterAdmin. |
| **Planos e limites** | Free: 50 livros / 50 MB · Premium: 500 livros / 500 MB · Pro: ilimitado / 5 GB · MasterAdmin: administrativo. |

---

## 3. Modelos de Dados

### Tenant

```js
{
  id: "uuid",
  name: "string",           // max 200 chars, obrigatório
  ownerId: "string|null",   // FK → User.id
  plan: 0 | 1 | 2 | 99,    // enum TenantPlan
  maxBooks: "number",       // padrão: 50
  maxStorageMB: "number",   // padrão: 50
  isActive: "boolean",      // padrão: true
  createdAt: "datetime",
  expiresAt: "datetime|null",
  stripeCustomerId: "string|null",
  setupCompleted: "boolean",
  setupCompletedAt: "datetime|null",

  // relacionamentos
  owner: User | null,
  subscription: Subscription | null,
  billingAddress: BillingAddress | null,
  payments: Payment[]
}
```

### User (ApplicationUser)

```js
{
  id: "string",             // ex: Identity GUID
  email: "string",
  fullName: "string|null",
  avatarPath: "string|null",
  createdAt: "datetime",
  lastLoginAt: "datetime|null",
  isActive: "boolean",
  isMasterAdmin: "boolean", // flag de acesso admin
  tenantId: "uuid|null",    // FK → Tenant.id (1:1)
  tenant: Tenant | null
}
```

---

## 4. Enum: TenantPlan

```js
const TenantPlan = {
  Free: 0,
  Premium: 1,
  Pro: 2,
  MasterAdmin: 99
};

// Labels para exibição
const TenantPlanLabel = {
  0: "Gratuito",
  1: "Premium",
  2: "Pro",
  99: "Master Admin"
};
```

---

## 5. Endpoints da API (Express)

> **Base URL:** `/api/admin`
> Todos os endpoints exigem autenticação **JWT** + verificação `isMasterAdmin = true`.

---

### 5.1 Admin Dashboard

**`GET /api/admin/dashboard`**

Retorna estatísticas globais do sistema e os 10 tenants mais recentes.

**Resposta `200 OK`:**

```json
{
  "totalTenants": 42,
  "activeTenants": 38,
  "totalUsers": 120,
  "totalBooks": 3400,
  "recentTenants": [
    {
      "id": "uuid",
      "name": "Biblioteca do João",
      "ownerName": "João Silva",
      "ownerEmail": "joao@email.com",
      "plan": 1,
      "isActive": true,
      "createdAt": "2025-01-15T10:00:00Z",
      "expiresAt": null,
      "bookCount": 45
    }
  ],
  "tenantsByPlan": [
    { "plan": 0, "count": 30 },
    { "plan": 1, "count": 8 },
    { "plan": 2, "count": 3 },
    { "plan": 99, "count": 1 }
  ]
}
```

**Lógica de implementação:**

```js
// Express handler
router.get('/dashboard', requireMasterAdmin, async (req, res) => {
  const [totalTenants, activeTenants, totalUsers, totalBooks] = await Promise.all([
    Tenant.count(),
    Tenant.count({ where: { isActive: true } }),
    User.count(),
    Book.count()
  ]);

  const recentTenants = await Tenant.findAll({
    include: [{ model: User, as: 'owner' }],
    order: [['createdAt', 'DESC']],
    limit: 10
  });

  const tenantsByPlan = await Tenant.findAll({
    attributes: ['plan', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
    group: ['plan']
  });

  res.json({ totalTenants, activeTenants, totalUsers, totalBooks, recentTenants, tenantsByPlan });
});
```

---

### 5.2 Tenants — Listar

**`GET /api/admin/tenants`**

Suporta filtros via query string.

**Query params:**

| Param | Tipo | Descrição |
|---|---|---|
| `search` | string | Filtra por nome do tenant ou email do owner |
| `plan` | number (0/1/2/99) | Filtra por plano |
| `active` | boolean | Filtra por status (true/false) |

**Resposta `200 OK`:**

```json
[
  {
    "id": "uuid",
    "name": "Biblioteca da Maria",
    "ownerEmail": "maria@email.com",
    "ownerName": "Maria Souza",
    "plan": 0,
    "isActive": true,
    "createdAt": "2025-02-01T00:00:00Z",
    "expiresAt": null,
    "bookCount": 12,
    "maxBooks": 50,
    "maxStorageMB": 50
  }
]
```

**Lógica de implementação:**

```js
router.get('/tenants', requireMasterAdmin, async (req, res) => {
  const { search, plan, active } = req.query;
  const where = {};

  if (search) {
    where[Op.or] = [
      { name: { [Op.like]: `%${search}%` } },
      { '$owner.email$': { [Op.like]: `%${search}%` } }
    ];
  }
  if (plan !== undefined) where.plan = Number(plan);
  if (active !== undefined) where.isActive = active === 'true';

  const tenants = await Tenant.findAll({
    where,
    include: [{ model: User, as: 'owner' }],
    order: [['createdAt', 'DESC']]
  });

  res.json(tenants);
});
```

---

### 5.3 Tenants — Detalhes

**`GET /api/admin/tenants/:id`**

**Parâmetros:** `id` (UUID)

**Resposta `200 OK`:**

```json
{
  "id": "uuid",
  "name": "Biblioteca do Pedro",
  "ownerEmail": "pedro@email.com",
  "ownerName": "Pedro Costa",
  "plan": 1,
  "isActive": true,
  "createdAt": "2025-01-10T00:00:00Z",
  "expiresAt": null,
  "maxBooks": 500,
  "maxStorageMB": 500,
  "currentBooks": 123,
  "currentCategories": 8,
  "owner": {
    "id": "user-id",
    "email": "pedro@email.com",
    "fullName": "Pedro Costa",
    "isMasterAdmin": false,
    "isActive": true,
    "createdAt": "2025-01-10T00:00:00Z",
    "lastLoginAt": "2025-06-01T08:30:00Z"
  }
}
```

**Resposta `404 Not Found`:** `{ "error": "Tenant não encontrado" }`

---

### 5.4 Tenants — Criar

**`POST /api/admin/tenants`**

**Body (JSON):**

```json
{
  "name": "Nova Biblioteca",
  "plan": 0,
  "isActive": true,
  "maxBooks": 100,
  "maxStorageMB": 100,
  "expiresAt": null
}
```

**Validações:**

| Campo | Regra |
|---|---|
| `name` | obrigatório, máx 200 caracteres |
| `plan` | obrigatório, valor válido do enum |
| `maxBooks` | obrigatório, inteiro > 0 |
| `maxStorageMB` | obrigatório, inteiro > 0 |
| `expiresAt` | opcional, datetime ISO 8601 |

**Resposta `201 Created`:**

```json
{
  "id": "novo-uuid",
  "name": "Nova Biblioteca",
  "plan": 0,
  "isActive": true,
  "maxBooks": 100,
  "maxStorageMB": 100,
  "expiresAt": null,
  "createdAt": "2025-06-10T12:00:00Z"
}
```

**Resposta `400 Bad Request`:**

```json
{
  "errors": {
    "name": "Nome é obrigatório",
    "maxBooks": "Máximo de livros deve ser maior que 0"
  }
}
```

---

### 5.5 Tenants — Editar

**`PUT /api/admin/tenants/:id`**

**Body (JSON):** mesmos campos do Create, mais o `id` no path.

```json
{
  "name": "Biblioteca Atualizada",
  "plan": 1,
  "isActive": true,
  "maxBooks": 500,
  "maxStorageMB": 500,
  "expiresAt": "2026-01-01T00:00:00Z"
}
```

**Resposta `200 OK`:** tenant atualizado.

**Resposta `404 Not Found`:** `{ "error": "Tenant não encontrado" }`

---

### 5.6 Tenants — Ativar/Desativar

**`PATCH /api/admin/tenants/:id/toggle-active`**

Alterna o campo `isActive` do tenant.

**Regra:** Tenants com `plan = 99 (MasterAdmin)` não podem ser desativados.

**Resposta `200 OK`:**

```json
{
  "id": "uuid",
  "name": "Biblioteca do João",
  "isActive": false,
  "message": "Biblioteca desativada com sucesso"
}
```

**Resposta `403 Forbidden`:**

```json
{ "error": "Não é possível desativar a biblioteca master!" }
```

---

### 5.7 Tenants — Deletar

**`DELETE /api/admin/tenants/:id`**

Deleção permanente em cascata. **Não pode ser desfeito.**

**Regra:** Tenants com `plan = 99 (MasterAdmin)` não podem ser deletados.

**Ordem de deleção (dentro de uma transaction):**

```
1. ReadingActivities WHERE tenantId = id
2. UserAchievements WHERE tenantId = id
3. UserProgresses WHERE tenantId = id
4. ReadingProgresses WHERE tenantId = id
5. Books WHERE tenantId = id
6. Categories WHERE tenantId = id
7. Payments WHERE tenantId = id
8. Subscription WHERE tenantId = id
9. BillingAddress WHERE tenantId = id
10. User (owner) WHERE id = tenant.ownerId
11. Tenant WHERE id = id
```

**Resposta `200 OK`:**

```json
{ "message": "Biblioteca 'Nome' e proprietário foram deletados com sucesso!" }
```

**Resposta `403 Forbidden`:**

```json
{ "error": "Não é possível deletar a biblioteca master!" }
```

**Resposta `500 Internal Server Error`:**

```json
{ "error": "Erro ao deletar tenant: <mensagem>" }
```

---

## 6. Middlewares Necessários

### `requireAuth` — Verificar JWT

```js
// middleware/requireAuth.js
const jwt = require('jsonwebtoken');

module.exports = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Não autenticado' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findByPk(decoded.id);
    if (!req.user) return res.status(401).json({ error: 'Usuário não encontrado' });
    next();
  } catch {
    res.status(401).json({ error: 'Token inválido' });
  }
};
```

### `requireMasterAdmin` — Verificar permissão admin

```js
// middleware/requireMasterAdmin.js
const requireAuth = require('./requireAuth');

module.exports = [requireAuth, (req, res, next) => {
  if (!req.user?.isMasterAdmin) {
    return res.status(403).json({ error: 'Acesso negado: requer Master Admin' });
  }
  next();
}];
```

---

## 7. Telas React

### 7.1 Dashboard

**Rota:** `/admin`

**Componentes:**

| Componente | Descrição |
|---|---|
| `StatCard` | Card com ícone, número e label (Total Tenants, Ativos, Usuários, Livros) |
| `PlanDistributionCard` | Card com lista de planos + barra de progresso + percentual |
| `RecentTenantsTable` | Tabela com as 10 bibliotecas mais recentes |

**Dados necessários (GET `/api/admin/dashboard`):**

```
totalTenants, activeTenants, totalUsers, totalBooks,
recentTenants[], tenantsByPlan[]
```

**Cálculo do percentual por plano:**

```js
const percentage = totalTenants > 0
  ? ((stat.count / totalTenants) * 100).toFixed(1)
  : 0;
```

**Cores dos badges de plano:**

```js
const planColors = {
  0: 'gray',      // Free
  1: 'blue',      // Premium
  2: 'purple',    // Pro
  99: 'red'       // MasterAdmin
};
```

---

### 7.2 Lista de Tenants

**Rota:** `/admin/tenants`

**Funcionalidades:**
- Filtros: campo de busca (nome ou email), select de plano, select de status (ativo/inativo)
- Tabela com colunas: Biblioteca, Proprietário, Plano, Limites, Status, Criado, Ações
- Ações por linha: **Detalhes**, **Editar**, **Deletar**

**Colunas da tabela:**

| Coluna | Campo(s) |
|---|---|
| Biblioteca | `name`, `createdAt` |
| Proprietário | `ownerName`, `ownerEmail` |
| Plano | badge colorido com `plan` |
| Limites | `maxBooks` (livros), `maxStorageMB` (MB) |
| Status | badge Ativo/Inativo baseado em `isActive` |
| Criado | `createdAt` formatado |
| Ações | links para detalhes, editar e deletar |

**Estado do filtro:**

```js
const [filters, setFilters] = useState({ search: '', plan: '', active: '' });
```

---

### 7.3 Detalhes do Tenant

**Rota:** `/admin/tenants/:id`

**Seções da tela:**

**Cards de uso (topo):**

| Card | Conteúdo |
|---|---|
| Livros | `currentBooks / maxBooks` + barra de progresso (vermelho se atingir limite) |
| Categorias | `currentCategories` |
| Armazenamento | `maxStorageMB MB` |

**Card "Informações Gerais":**

```
Status:    badge Ativo / Inativo
Plano:     badge com nome do plano
Criado em: createdAt formatado
Expira em: expiresAt (badge EXPIRADO se data passada)
```

**Card "Proprietário":**

```
Nome:  owner.fullName
Email: owner.email (link mailto)
```

**Botões de ação:**
- **Editar** → `/admin/tenants/:id/edit`
- **Ativar / Desativar** (PATCH toggle-active) — oculto para plano MasterAdmin
- **Voltar** → `/admin/tenants`

---

### 7.4 Criar Tenant

**Rota:** `/admin/tenants/new`

**Formulário:**

| Campo | Tipo | Regra |
|---|---|---|
| Nome da Biblioteca | text | obrigatório, máx 200 |
| Plano | select (Free/Premium/Pro/MasterAdmin) | obrigatório |
| Máximo de Livros | number (min: 1) | obrigatório |
| Máximo de Armazenamento (MB) | number (min: 1) | obrigatório |
| Data de Expiração | datetime-local | opcional |
| Ativo | toggle/checkbox | padrão: true |

**Valores padrão:**

```js
const initialValues = {
  name: '',
  plan: 0,
  isActive: true,
  maxBooks: 100,
  maxStorageMB: 100,
  expiresAt: ''
};
```

**Sidebar informativa (dicas de planos):**

```
Free:        50 livros, 50 MB
Premium:     500 livros, 500 MB
Pro:         Ilimitado, 5 GB
MasterAdmin: Acesso administrativo
```

Após sucesso, redirecionar para **detalhes** do tenant criado.

---

### 7.5 Editar Tenant

**Rota:** `/admin/tenants/:id/edit`

Formulário idêntico ao de criação, porém com `id` oculto e campos pré-preenchidos com os dados atuais.

**Sidebar de atenção:**

```
Alterar limites:    Reduções podem impactar o usuário.
Desativar:          O usuário não poderá fazer login.
Alterar plano:      Afeta os limites e recursos disponíveis.
```

Após sucesso, redirecionar para **detalhes** do tenant.

---

### 7.6 Deletar Tenant

**Rota:** `/admin/tenants/:id/delete` (ou modal de confirmação)

**Tela de confirmação exibe:**

```
Nome:        tenant.name
Plano:       badge
Proprietário: owner.fullName (owner.email)
Criado em:   createdAt formatado
```

**Alert de aviso — dados que serão deletados:**

```
- O usuário proprietário e seus dados de acesso
- Todos os livros da biblioteca
- Todas as categorias
- Todo o progresso de leitura
- Todos os dados de gamificação (conquistas, atividades)
- Informações de pagamento e assinatura
- Todos os dados relacionados

⚠ Esta ação não pode ser desfeita!
```

Após confirmação (DELETE `/api/admin/tenants/:id`), redirecionar para a lista.

---

## 8. Estrutura de Pastas Sugerida

### Backend (Node.js + Express)

```
src/
├── middleware/
│   ├── requireAuth.js
│   └── requireMasterAdmin.js
├── routes/
│   └── admin/
│       ├── index.js          # dashboard
│       └── tenants.js        # CRUD tenants
├── controllers/
│   └── admin/
│       ├── dashboardController.js
│       └── tenantsController.js
├── models/
│   ├── Tenant.js
│   ├── User.js
│   ├── Book.js
│   ├── Category.js
│   ├── Payment.js
│   ├── Subscription.js
│   └── BillingAddress.js
└── app.js
```

### Frontend (React)

```
src/
├── pages/
│   └── admin/
│       ├── Dashboard.jsx
│       ├── tenants/
│       │   ├── TenantList.jsx
│       │   ├── TenantDetails.jsx
│       │   ├── TenantCreate.jsx
│       │   ├── TenantEdit.jsx
│       │   └── TenantDelete.jsx
├── components/
│   └── admin/
│       ├── StatCard.jsx
│       ├── PlanBadge.jsx
│       ├── PlanDistributionCard.jsx
│       ├── RecentTenantsTable.jsx
│       └── TenantForm.jsx
├── services/
│   └── adminService.js       # chamadas à API
└── routes/
    └── AdminRoutes.jsx       # rotas protegidas
```

### `adminService.js` (exemplo)

```js
import api from './api'; // instância axios com baseURL e token

const adminService = {
  getDashboard: () => api.get('/admin/dashboard'),

  getTenants: (filters) => api.get('/admin/tenants', { params: filters }),
  getTenantById: (id) => api.get(`/admin/tenants/${id}`),
  createTenant: (data) => api.post('/admin/tenants', data),
  updateTenant: (id, data) => api.put(`/admin/tenants/${id}`, data),
  toggleActive: (id) => api.patch(`/admin/tenants/${id}/toggle-active`),
  deleteTenant: (id) => api.delete(`/admin/tenants/${id}`)
};

export default adminService;
```

### Rotas protegidas React

```jsx
// AdminRoutes.jsx
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function AdminRoutes() {
  const { user } = useAuth();
  if (!user?.isMasterAdmin) return <Navigate to="/" />;
  return <Outlet />;
}

// Em App.jsx:
<Route element={<AdminRoutes />}>
  <Route path="/admin" element={<Dashboard />} />
  <Route path="/admin/tenants" element={<TenantList />} />
  <Route path="/admin/tenants/new" element={<TenantCreate />} />
  <Route path="/admin/tenants/:id" element={<TenantDetails />} />
  <Route path="/admin/tenants/:id/edit" element={<TenantEdit />} />
  <Route path="/admin/tenants/:id/delete" element={<TenantDelete />} />
</Route>
```

---

## 9. Validações

### Backend (Express — exemplo com `express-validator`)

```js
const { body, validationResult } = require('express-validator');

const tenantValidation = [
  body('name')
    .notEmpty().withMessage('Nome é obrigatório')
    .isLength({ max: 200 }).withMessage('Nome deve ter no máximo 200 caracteres'),
  body('plan')
    .isIn([0, 1, 2, 99]).withMessage('Plano inválido'),
  body('maxBooks')
    .isInt({ min: 1 }).withMessage('Máximo de livros deve ser maior que 0'),
  body('maxStorageMB')
    .isInt({ min: 1 }).withMessage('Máximo de armazenamento deve ser maior que 0'),
  body('expiresAt')
    .optional({ nullable: true })
    .isISO8601().withMessage('Data de expiração inválida'),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.mapped() });
    }
    next();
  }
];
```

### Frontend (React — exemplo com `react-hook-form`)

```js
const { register, handleSubmit, formState: { errors } } = useForm({
  defaultValues: { name: '', plan: 0, isActive: true, maxBooks: 100, maxStorageMB: 100 }
});

const rules = {
  name: { required: 'Nome é obrigatório', maxLength: { value: 200, message: 'Máximo 200 caracteres' } },
  maxBooks: { required: true, min: { value: 1, message: 'Deve ser maior que 0' } },
  maxStorageMB: { required: true, min: { value: 1, message: 'Deve ser maior que 0' } }
};
```

---

## 10. Observações Gerais

| Tópico | Detalhe |
|---|---|
| **Autenticação** | Usar JWT com claim `isMasterAdmin: true` para acesso ao painel. |
| **Autorização** | Verificar `isMasterAdmin` em **todo** endpoint admin, tanto no backend quanto na proteção de rotas React. |
| **Formato de datas** | O .NET usa UTC. Normalizar todas as datas para UTC no backend e formatar no frontend (`toLocaleDateString('pt-BR')`). |
| **IDs** | Todos os IDs de tenant são **UUID v4**. Usar `crypto.randomUUID()` ou biblioteca `uuid` ao criar. |
| **Transações** | A deleção em cascata **deve** ocorrer dentro de uma transaction de banco de dados para garantir consistência. |
| **TempData / Feedback** | Substituir o `TempData["SuccessMessage"]` por notificações toast no React (ex.: `react-hot-toast` ou `react-toastify`). |
| **Anti-Forgery Token** | No .NET há proteção CSRF via `[ValidateAntiForgeryToken]`. Na API REST com JWT, isso não é necessário se o token for enviado via `Authorization: Bearer`. |
| **Plano MasterAdmin** | O tenant com `plan = 99` é o tenant do sistema. Nunca deve ser deletado ou desativado. Proteger no backend e ocultar botões no frontend. |
| **Paginação** | A listagem atual retorna todos os tenants filtrados sem paginação. Considerar adicionar `page` e `pageSize` para escalar. |
