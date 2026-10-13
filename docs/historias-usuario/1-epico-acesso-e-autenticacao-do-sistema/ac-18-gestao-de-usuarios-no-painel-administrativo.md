# AC-18 Gestão de usuários no painel administrativo (RF001, RF025)

- **Épico**: Administração e Controle de Acesso
- **Requisitos Funcionais**: RF001 (Cadastrar Usuário), RF025 (Controle de Acesso RBAC), RF026 (Topologia de UBS)
- **Requisitos Não-Funcionais**: NF002 (Responsividade), NF003 (Idioma pt-BR), NF009 (Menor Privilégio), NF011 (Criptografia de Senha), NF012 (Sessão Segura)
- **ADRs Vinculadas**: ADR-002 (Multi-tenancy e Escopos Globais), ADR-006 (RBAC), ADR-011 (React 19 + Vite), ADR-012 (CSR), ADR-013 (TanStack Query + Context API), ADR-022 (`@farmaubs/shared`), ADR-030 (Pirâmide de Testes - Camada D), ADR-032 (Acessibilidade WCAG 2.1 AA)

---

## 1. História de Usuário

> **Como** Administrador do FarmaUBS (visão global/sistêmica),  
> **quero** gerenciar todos os usuários do sistema por meio de um painel administrativo centralizado (listagem paginada, filtros por município, status e perfil, criação, edição e inativação com confirmação),  
> **para que** eu mantenha o controle seguro de operadores e farmacêuticos em qualquer município atendido, associando-os às UBSs corretas sem depender de operações manuais no banco de dados.

---

## 2. Regras de Negócio e Casos de Borda

1. **Escopo Global do Administrador (ADR-002, ADR-006, RF025)**:
   - O perfil `ADMINISTRADOR` não é restrito a um único município nas tabelas administrativas (escopo global em `users`, `municipios` e `unidades_saude`).
   - O Administrador visualiza usuários de **todos os municípios**, podendo utilizar o filtro por município para focar em uma localidade.

2. **Seleção em Cascata no Cadastro (Município ➔ UBSs)**:
   - O formulário de cadastro possui um campo obrigatório de seleção de **Município** (alimentado por `GET /api/v1/administracao/municipios`).
   - Ao selecionar um município, o formulário desbloqueia e filtra dinamicamente as **UBSs pertencentes exclusivamente àquele município** (`GET /api/v1/administracao/unidades-saude?municipioId=...`).
   - A submissão exige ao menos uma UBS vinculada (`ubsIds.length >= 1`). A seleção cruzada de UBS de outro município é bloqueada client-side e rejeitada pelo backend (`400 Bad Request - UnidadeSaudeInvalidaException`).

3. **Restrição de Acesso RBAC no Frontend (RF025, NF009)**:
   - O painel `/admin/usuarios` e o menu de "Gestão de Usuários" são visíveis e acessíveis **exclusivamente** para usuários cujo token/sessão possua o perfil `ADMINISTRADOR`.
   - Tentativas de acesso direto por outros perfis (`FARMACEUTICO_RESPONSAVEL`, `FARMACEUTICO_RESIDENTE`, `GERENTE`) são interceptadas por guarda de rota (`RoleRoute`) e redirecionadas para a tela de Acesso Negado (`/403`).

4. **Regras de Senha e Credenciais**:
   - A senha inicial cadastrada no client-side deve ter no mínimo 8 caracteres, contendo letras e números.
   - O usuário recém-criado nasce com a flag `deveTrocarSenha: true` (RF001).

5. **Inativação Lógica e Auditoria SUS**:
   - Usuários **nunca são excluídos** fisicamente do banco de dados para preservar a rastreabilidade e histórico de dispensações. A inativação comuta a flag booleana `ativo` (`true` / `false`).
   - **Bloqueio de Auto-inativação**: Na listagem, o botão de inativar fica desabilitado com aviso contextual na linha do próprio Administrador logado (`usuario.id === session.usuario.id`).
   - **Último Administrador**: Caso a API retorne conflito ao tentar inativar o último administrador ativo, o frontend exibe alerta explicativo claro.

6. **Feedback e Tratamento de Erros HTTP**:
   - `400 Bad Request`: Mensagens de validação detalhadas associadas aos campos correspondentes.
   - `409 Conflict`: Alerta em destaque indicando que o e-mail informado já está cadastrado no sistema, preservando os dados já preenchidos nos outros campos.
   - `403 Forbidden`: Bloqueio imediato com feedback visual amigável.
   - `Erro de Rede / 5xx`: Banner com botão de "Tentar Novamente".

---

## 3. Contratos de Dados e Tipagens (`@farmaubs/shared`)

### 3.1 Rotas Utilizadas
- Listagem de Usuários: `GET /api/v1/usuarios?page=1&limit=10&busca=&municipioId=&status=&perfilId=`
- Criação de Usuário: `POST /api/v1/usuarios`
- Edição / Associações: `PATCH /api/v1/usuarios/:id` e `PUT /api/v1/usuarios/:id/associacoes`
- Inativação / Reativação: `PATCH /api/v1/usuarios/:id/status`
- Catálogo de Municípios: `GET /api/v1/administracao/municipios`
- Catálogo de Unidades de Saúde: `GET /api/v1/administracao/unidades-saude`
- Catálogo de Perfis: Enum compartilhado `PerfilCodigo` ou `GET /api/v1/acesso/perfis`

### 3.2 Tipagens Compartilhadas

```typescript
// Contrato de Criação de Usuário (Request DTO - @farmaubs/shared)
export interface CadastrarUsuarioComando {
  municipioId: string; // Selecionado no formulário pelo Administrador
  nomeCompleto: string;
  email: string;
  senha: string;
  perfil: string;      // ID ou código do perfil (PerfilCodigo)
  ubsIds: string[];    // Pelo menos 1 UBS do município selecionado
}

// Resposta da Criação (Response DTO - @farmaubs/shared)
export interface CadastrarUsuarioResultado {
  id: string;
  municipioId: string;
  nomeCompleto: string;
  email: string;
  perfilId: string;
  ativo: boolean;
  deveTrocarSenha: boolean;
  ubsIds: string[];
  criadoEm: Date;
}

// Item da Listagem Global de Usuários
export interface UsuarioItemTabela {
  id: string;
  municipioId: string;
  municipioNome: string;
  nomeCompleto: string;
  email: string;
  perfilCodigo: PerfilCodigo;
  perfilNome: string;
  unidades: Array<{ id: string; nome: string }>;
  ativo: boolean;
  ultimoLoginEm?: string | null;
  createdAt: string;
}
```

---

## 4. Arquitetura no Frontend (`apps/frontend/`)

Conforme a Seção 1.2 do [CONTRIBUTING.md](file:///c:/Users/jaohe/projetos/farmaubs/CONTRIBUTING.md):

```text
apps/frontend/src/
├── pages/
│   └── AdminUsuarios/
│       ├── index.tsx                   # Tabela global, filtros (município, status, perfil) e paginação
│       ├── UsuarioModalForm.tsx        # Modal de criação/edição com seleção em cascata Município -> UBSs
│       ├── ConfirmarInativacaoModal.tsx# Diálogo acessível de confirmação de inativação/reativação
│       └── AdminUsuarios.spec.tsx      # Testes de componente e acessibilidade (Camada D)
├── services/
│   └── usuario.service.ts              # Requisições HTTP com Axios tipadas por @farmaubs/shared
├── hooks/
│   └── useUsuarios.ts                  # useQuery e useMutation do TanStack Query
└── components/
    └── RoleRoute.tsx                   # Guarda de rota protegida por perfil (RBAC)
```

---

## 5. Critérios de Aceite Detalhados

- [x] **Guarda de Acesso (RBAC)**: Rota `/admin/usuarios` protegida exclusivamente para o perfil `ADMINISTRADOR`. Outros perfis são redirecionados para `/403`. O item de menu "Gestão de Usuários" é renderizado apenas para o Administrador.
- [x] **Tabela Global com Coluna de Município**: A tabela exibe Nome Completo, E-mail, Município, Perfil, UBSs Vinculadas (tags/badges) e Status (`Ativo` / `Inativo`), com suporte a paginação (10 itens por página).
- [x] **Filtros Combinados**:
  - Filtro por **Município** (`Todos` ou seleção específica de um município).
  - Filtro por **Perfil** (`Todos`, `Farmacêutico Responsável`, `Farmacêutico Residente`, `Gerente`, `Administrador`).
  - Filtro por **Status** (`Todos`, `Ativo`, `Inativo`).
  - Campo de **Busca Textual** (Nome ou E-mail) com *debounce* de 300ms.
- [x] **Seleção em Cascata no Cadastro**:
  - O campo de **Município** é obrigatório e preenchido via `GET /api/v1/administracao/municipios`.
  - Ao selecionar o município, o campo de **UBSs** é habilitado exibindo apenas as unidades de saúde daquele município para seleção múltipla.
  - Se o Administrador alterar o município selecionado, a seleção prévia de UBSs é resetada para evitar inconsistências.
- [x] **Validação Client-Side com Zod**:
  - `nomeCompleto`: obrigatório, mínimo 3 caracteres.
  - `email`: formato válido, normalizado para minúsculas.
  - `senha`: mínimo 8 caracteres com letras e números.
  - `municipioId`: seleção obrigatória.
  - `perfil`: seleção obrigatória de 1 perfil.
  - `ubsIds`: no mínimo 1 UBS do município selecionado.
- [x] **Tratamento de Conflito de E-mail (409)**: Ao receber status 409 da API, o modal permanece aberto, destaca o campo de e-mail em vermelho com a mensagem *"Este e-mail já está em uso por outro usuário"* e preserva os demais campos preenchidos.
- [x] **Inativação com Confirmação e Bloqueio de Auto-inativação**:
  - Clique em "Inativar" abre modal de confirmação acessível alertando sobre a perda de acesso.
  - Botão de inativação **desabilitado** para o próprio usuário logado (`usuario.id === session.usuario.id`), exibindo tooltip explicativo *"Você não pode inativar sua própria conta"*.
  - Ao confirmar, dispara `PATCH /api/v1/usuarios/:id/status`, invalida o cache do TanStack Query e exibe notificação toast de sucesso.
- [x] **Estados de Carregamento**: Botões de envio exibem spinner visual e desabilitação durante requisições (`isPending`) para evitar cliques duplicados.
- [x] **Acessibilidade (ADR-032 / WCAG 2.1 AA)**: Modais com foco retido (*focus trap*), fechamento via `Escape`, `aria-describedby` para mensagens de erro, foco visível e ordem lógica de navegação por `Tab`.

---

## 6. Cenários de Teste em BDD (Gherkin — Camada D / Vitest)

### Cenário 1: Bloqueio de acesso para perfil não-administrador
```gherkin
# language: pt
Funcionalidade: Controle de Acesso ao Painel de Usuários (RF025)

  Cenário: Farmacêutico tenta acessar a gestão de usuários
    Dado que o usuário está autenticado com o perfil "FARMACEUTICO_RESPONSAVEL"
    Quando ele navegar para a rota "/admin/usuarios"
    Então a aplicação redireciona para a tela de acesso negado "/403"
    E a tabela de usuários não é renderizada no DOM
    E nenhuma chamada para "/api/v1/usuarios" é disparada
```

### Cenário 2: Listagem global filtrada por município
```gherkin
  Cenário: Administrador filtra a listagem por um município específico
    Dado que o Administrador está autenticado e acessa "/admin/usuarios"
    E existem usuários cadastrados em "São Paulo" e "Campinas"
    Quando o Administrador seleciona o município "Campinas" no filtro
    Então a tabela é atualizada exibindo apenas os usuários de "Campinas"
    E a paginação reflete a contagem do município filtrado
```

### Cenário 3: Seleção em cascata de Município e UBS no cadastro
```gherkin
  Cenário: Seleção do município carrega dinamicamente as UBSs daquela cidade
    Dado que o Administrador abriu o modal de cadastro de usuário
    Quando ele seleciona o município "Santos"
    Então a lista de UBSs é habilitada exibindo apenas unidades de saúde de "Santos"
    Quando ele preencher os dados:
      | Campo         | Valor                          |
      | Nome Completo | Lucas Fernandes                |
      | E-mail        | lucas.fernandes@farmaubs.gov.br|
      | Senha         | SenhaForte@2026                |
      | Perfil        | Farmacêutico Responsável       |
    E selecionar a "UBS Gonzaga" e "UBS Boqueirão"
    E clicar em "Salvar Usuário"
    Então a requisição POST envia "municipioId" de "Santos" e as UBSs selecionadas
    E o modal é fechado e uma mensagem de sucesso é exibida
```

### Cenário 4: Cadastro interrompido por e-mail duplicado (409 Conflict)
```gherkin
  Cenário: Tentativa de cadastro com e-mail já existente
    Dado que o Administrador está preenchendo o formulário de cadastro
    E informa o e-mail "carlos.silva@farmaubs.gov.br" que já existe na base
    Quando ele submeter o formulário
    E a API responder com status 409 Conflict
    Então o modal permanece aberto
    E o campo de e-mail exibe a mensagem "Este e-mail já está em uso por outro usuário"
    E os demais campos (nome, município e UBSs) permanecem preenchidos
```

### Cenário 5: Inativação com diálogo de confirmação
```gherkin
  Cenário: Inativação de usuário com confirmação explícita
    Dado que existe o usuário "Mariana Dias" com status "Ativo" na listagem
    Quando o Administrador clica na ação "Inativar" da linha de Mariana
    Então um diálogo de confirmação acessível é aberto alertando sobre a perda de acesso
    Quando o Administrador confirma a inativação
    Então a requisição PATCH para alteração de status é enviada
    E o diálogo de confirmação é fechado
    E o status de Mariana passa a ser exibido como "Inativo"
```

### Cenário 6: Prevenção de auto-inativação do administrador logado
```gherkin
  Cenário: Administrador localiza seu próprio registro na listagem
    Dado que o Administrador logado possui o e-mail "admin.global@farmaubs.gov.br"
    Quando ele visualizar seu próprio registro na tabela de usuários
    Então o botão de inativação correspondente deve estar desabilitado
    E ao focar ou passar o mouse no botão, exibe o aviso "Você não pode inativar sua própria conta"
```

---

## 7. Definition of Done (DoD)

1. **Código e Padrões**:
   - Componentes modularizados em `apps/frontend/src/pages/AdminUsuarios/` conforme o `CONTRIBUTING.md`.
   - Formulários com validação Zod + React Hook Form e cascata reativa de Município ➔ UBSs.
   - Chamadas HTTP isoladas em `usuario.service.ts` e orquestradas por hooks TanStack Query com invalidação de cache.
2. **Qualidade e Testes**:
   - Testes de componente da Camada D (`AdminUsuarios.spec.tsx`) cobrindo renderização global, filtro por município, cascata no cadastro, erro 409 e acessibilidade com `@testing-library/react` e `@testing-library/user-event`.
   - `pnpm --filter @farmaubs/frontend test` passando com 100% de sucesso.
   - `pnpm --filter @farmaubs/frontend build` (`tsc -b && vite build`) executando com zero erros.
3. **Acessibilidade e Design**:
   - Modais com *focus trap*, fechamento em `Escape` e labels associados (WCAG 2.1 AA).
   - Textos e feedbacks totalmente em Português do Brasil (NF003).