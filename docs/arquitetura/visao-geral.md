# Arquitetura do sistema e mapa de módulos (FarmaUBS)

Este documento descreve a visão geral da arquitetura de software, o modelo de contexto dos clientes e servidores, e as fronteiras dos módulos de domínio do FarmaUBS.

---

## 1. Visão de contexto (C4 - nível 1)

O FarmaUBS opera no contexto da Atenção Primária à Saúde (SUS), atendendo as farmácias das Unidades Básicas de Saúde (UBS) e almoxarifados municipais de saúde (CAF).

```mermaid
flowchart TB
    Farmaceutico["Farmacêutico / Operador da UBS"]
    Admin["Administrador / Gestor Municipal"]
    
    subgraph FarmaUBS["Ecossistema FarmaUBS"]
        Web["SPA Web React\n(Desktop nas farmácias)"]
        Mobile["App Mobile Expo\n(Conferência física na bancada)"]
        API["API REST NestJS\n(Clean Architecture Pura)"]
        Shared["@farmaubs/shared\n(Contratos e tipos agnósticos)"]
        DB[(PostgreSQL 18\nRLS Multi-tenant)]
    end

    CAF["CAF Central / DLOG MS\n(Fornecedores de Medicamentos)"]
    Paciente["Cidadão / Paciente SUS\n(Receituário Médico)"]

    Farmaceutico -->|Opera conferência e estoque| Web
    Farmaceutico -->|Conferência física de lotes| Mobile
    Admin -->|Gestão de usuários e relatórios| Web

    Web -->|Requisições HTTPS / Cookie| API
    Mobile -->|Requisições HTTPS / Bearer Token| API
    Web -.->|Consome contratos| Shared
    Mobile -.->|Consome contratos| Shared
    API -.->|Consome contratos| Shared
    API -->|Pool de conexões / RLS| DB

    CAF -.->|Envia Guias e Remessas| Farmaceutico
    Paciente -.->|Apresenta Prescrição| Farmaceutico
```

---

## 2. Visão de containers (C4 - nível 2)

O monorepo divide as responsabilidades em workspaces independentes conectados pelo Moonrepo:

```mermaid
flowchart LR
    subgraph Clients["Camada de Apresentação"]
        Web["apps/frontend\nReact 19, Vite, Tailwind v4\nTanStack Query"]
        Mobile["apps/mobile\nReact Native, Expo SDK 52\nexpo-secure-store"]
    end

    subgraph Core["Núcleo Compartilhado"]
        Shared["packages/shared\nDTOs, Enums de domínio, Validadores\nZero dependência de framework"]
    end

    subgraph Server["Camada de Servidor"]
        API["apps/backend\nNestJS 11 na borda\nUse Cases puros em TypeScript\nTypeORM Migrations"]
    end

    subgraph Storage["Camada de Dados"]
        PG["PostgreSQL 18\nSchema public com RLS por município/UBS\nFunções PL/pgSQL para sessão"]
    end

    Web --> Shared
    Mobile --> Shared
    API --> Shared

    Web -->|REST /api/v1| API
    Mobile -->|REST /api/v1| API
    API -->|SQL via pool farmaubs_app| PG
```

---

## 3. Módulos de domínio (Bounded Contexts)

O backend organiza as regras de negócio em módulos verticais com Clean Architecture clássica:

```mermaid
flowchart TD
    subgraph Acesso["Módulo: Acesso e Autenticação"]
        Auth["Login, Logout, Sessão Server-side\nTroca de Senha, 2FA, RLS Interceptor"]
    end

    subgraph Administracao["Módulo: Administração"]
        AdminUsers["Gestão de Usuários, Vínculo de UBSs\nTopologia de Municípios e Unidades"]
    end

    subgraph Recebimento["Módulo: Recebimento de Medicamentos"]
        Rec["Conferência de Guia CAF, Catálogo REMUME\nLaboratórios, Lotes, Validade Curta, Estorno"]
    end

    subgraph Dispensacao["Módulo: Dispensação (Em andamento)"]
        Disp["Atendimento a Prescrições, Baixa de Saldo\nValidação de Paciente/CNS, Livro de Saída"]
    end

    subgraph EstoqueAuditoria["Módulo Compartilhado: Estoque e Auditoria"]
        Lotes["Tabela lotes com saldo atômico"]
        Ledger["Livro-razão movimentacoes_estoque\n(Audit trail imutável)"]
    end

    Recebimento -->|Incrementa saldo| Lotes
    Recebimento -->|Registra ENTRADA_RECEBIMENTO| Ledger
    Dispensacao -->|Deduz saldo com lock| Lotes
    Dispensacao -->|Registra SAIDA_DISPENSACAO| Ledger
    Acesso -->|Propaga tenant_id e ubs_id| Recebimento
    Acesso -->|Propaga tenant_id e ubs_id| Dispensacao
    Administracao -->|Provê UBSs e Perfis| Acesso
```

---

## 4. Regras de comunicação e fronteiras arquiteturais

1. **Pureza do Domínio (ADR-003, ADR-033):**
   - Use cases e entidades não conhecem NestJS, TypeORM, Express ou React.
   - Qualquer dependência externa é invertida através de portas (interfaces em `domain/ports/`).
2. **Isolamento de Escopo (ADR-035):**
   - Frontend web e backend nunca compartilham código de infraestrutura.
   - Todo tipo que trafega pela rede deve ser declarado em `packages/shared/src/<modulo>/<recurso>.types.ts`.
3. **Segurança Multi-tenant (ADR-002, ADR-016):**
   - Cada requisição autenticada define o contexto via `SET LOCAL app.municipio_id` e `SET LOCAL app.current_ubs_id`.
   - O PostgreSQL impede vazamento de dados entre UBSs ou municípios distintos via Row-Level Security nativo.
