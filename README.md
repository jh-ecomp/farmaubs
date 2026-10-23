<h1 align="center">FarmaUBS</h1>

<p align="center">
  <strong>Gestão farmacêutica e rastreabilidade de medicamentos para a Atenção Primária do SUS</strong>
</p>

<p align="center">
  <img alt="Node.js" src="https://img.shields.io/badge/Node.js-20_LTS-339933?logo=node.js&logoColor=white">
  <img alt="PNPM" src="https://img.shields.io/badge/pnpm-11.21-F69220?logo=pnpm&logoColor=white">
  <img alt="Moonrepo" src="https://img.shields.io/badge/moonrepo-2.5+-7952B3?logo=moonrepo&logoColor=white">
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white">
  <img alt="NestJS" src="https://img.shields.io/badge/NestJS-11.x-E0234E?logo=nestjs&logoColor=white">
  <img alt="React" src="https://img.shields.io/badge/React-19.x-61DAFB?logo=react&logoColor=black">
  <img alt="Expo" src="https://img.shields.io/badge/Expo-SDK_52-000020?logo=expo&logoColor=white">
  <img alt="PostgreSQL" src="https://img.shields.io/badge/PostgreSQL-18-4169E1?logo=postgresql&logoColor=white">
  <img alt="Licença" src="https://img.shields.io/badge/licença-GNU_GPL_v3-brightgreen">
</p>

---

## Sumário

1. [Sobre o projeto](#1-sobre-o-projeto)
2. [Principais recursos](#2-principais-recursos)
3. [Arquitetura e tecnologias](#3-arquitetura-e-tecnologias)
4. [Estrutura do monorepo](#4-estrutura-do-monorepo)
5. [Início rápido](#5-início-rápido)
6. [Comandos do Moonrepo](#6-comandos-do-moonrepo)
7. [Autores](#7-autores)
8. [Licença](#8-licença)

---

## 1. Sobre o projeto

O **FarmaUBS** é um ecossistema de software concebido para atender à rotina dos profissionais farmacêuticos, operadores de saúde e gestores da Atenção Primária à Saúde (SUS), com foco na realidade operacional das Unidades Básicas de Saúde (UBS) de Parnaíba-PI.

O sistema elimina o controle manual em planilhas físicas e cadernos de bancada, fornecendo rastreabilidade completa por lote, validade e fabricante, atualização de estoque em tempo real e controle estrito de perdas por validade curta.

---

## 2. Principais recursos

- **Controle de acesso e multi-tenancy (RLS):** Isolamento rigoroso de dados por município e unidade de saúde diretamente no banco de dados via Row-Level Security no PostgreSQL (ADR-016), com suporte a perfis de farmacêutico, operador e administrador.
- **Recebimento de cargas e conferência:** Entrada atômica de remessas enviadas por CAF Central, Ministério da Saúde (DLOG) e fornecedores, com validação de documento fiscal, lote, validade, fabricante e bloqueio de itens vencidos.
- **Alerta de validade curta:** Notificação automática e confirmação assistida para medicamentos com vencimento inferior a 6 meses (180 dias).
- **Dispensação rastreada:** Atendimento a prescrições médicas com baixa atômica de saldo e registro no livro de movimentações.
- **Histórico e auditoria operacional:** Filtros temporais inteligentes (padrão ontem e hoje ou range customizado), comprovante para impressão no navegador e exportação tabular em planilhas Excel (.xlsx).
- **Multiplataforma:** Aplicação web para estações de trabalho e aplicativo nativo móvel para conferência física em campo.

---

## 3. Arquitetura e tecnologias

O FarmaUBS é desenvolvido como um monorepo governado pelo **Moonrepo** (ADR-035) sobre o gerenciador de pacotes **PNPM**:

- **Backend (`apps/backend`):** Clean Architecture pura desacoplada de frameworks (ADR-003, ADR-033). Regras de domínio e casos de uso em TypeScript puro; NestJS na borda como adaptador de infraestrutura; PostgreSQL 18 com Row-Level Security (RLS) e TypeORM para migrações.
- **Frontend (`apps/frontend`):** Single Page Application com React 19, TypeScript, Vite, Tailwind CSS v4, TanStack Query (React Query) e React Router DOM (ADR-011, ADR-012).
- **Mobile (`apps/mobile`):** Aplicativo nativo em React Native com Expo SDK 52, componentes visuais nativos e armazenamento criptografado de credenciais via Keystore/Keychain (ADR-034).
- **Pacote compartilhado (`packages/shared`):** Contratos DTO de request e response, enums de negócio e validadores agnósticos consumidos por todos os clientes (ADR-022).
- **Qualidade e BDD:** Especificação viva com Cucumber.js e Chai em português para cenários de negócio, somados a testes automatizados nas camadas unitária, integração de banco e componentes.

---

## 4. Estrutura do monorepo

```text
farmaubs/
├── .moon/              # Configuração global de tarefas e toolchain do Moonrepo
├── apps/
│   ├── backend/        # API REST NestJS (Clean Architecture Pura + Ports & Adapters)
│   ├── frontend/       # SPA Web React 19 + Vite
│   └── mobile/         # App Móvel React Native + Expo SDK 52
├── packages/
│   └── shared/         # Contratos DTO, enums e validações agnósticas compartilhadas
├── infra/              # Docker Compose (desenvolvimento, testes e produção) e Nginx
├── docs/               # Documentação técnica, ADRs (ADR-001 a ADR-035) e histórias de usuário
├── pnpm-workspace.yaml # Configuração de workspaces do PNPM
└── CONTRIBUTING.md     # Guia do desenvolvedor e padrões de engenharia
```

---

## 5. Início rápido

### Pré-requisitos

- Node.js 20 LTS (especificado no toolchain do Moonrepo)
- PNPM 11 (`corepack enable pnpm`)
- Docker e Docker Compose

### 1. Clonar o repositório e configurar variáveis

```bash
git clone https://github.com/jh-ecomp/farmaubs.git
cd farmaubs

# Copie o arquivo de exemplo de ambiente
cp .env.example .env
```

Gere segredos seguros para as variáveis `SESSION_SECRET` e `ENCRYPTION_KEY`:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 2. Infraestrutura e comandos Docker

Inicie e gerencie os containers locais com os comandos abaixo:

```bash
# Subir todos os serviços em background
docker compose -f infra/docker-compose.yml -f infra/docker-compose.dev.yml up -d

# Forçar recriação completa dos containers
docker compose -f infra/docker-compose.yml -f infra/docker-compose.dev.yml up -d --force-recreate

# Acompanhar logs em tempo real (escolha: api, frontend ou postgres)
docker compose -f infra/docker-compose.yml -f infra/docker-compose.dev.yml logs -f api

# Verificar status e integridade dos containers
docker compose -f infra/docker-compose.yml -f infra/docker-compose.dev.yml ps

# Reiniciar um serviço específico
docker compose -f infra/docker-compose.yml -f infra/docker-compose.dev.yml restart api

# Parar os serviços mantendo o banco intacto
docker compose -f infra/docker-compose.yml -f infra/docker-compose.dev.yml down

# Parar e apagar volumes do banco (reset completo dos dados)
docker compose -f infra/docker-compose.yml -f infra/docker-compose.dev.yml down -v
```

### 3. Acessos locais

| Serviço | URL | Descrição |
| --- | --- | --- |
| **Frontend Web** | `http://localhost:5173` | Aplicação web para farmacêuticos e administradores |
| **API REST** | `http://localhost:3000/api/v1` | Ponto de entrada da API |
| **Swagger UI** | `http://localhost:3000/api/v1/docs` | Documentação interativa dos endpoints OpenAPI |
| **PostgreSQL** | `localhost:5434` | Banco de dados local de desenvolvimento |

---

## 6. Comandos do Moonrepo

Todas as tarefas de compilação, testes e execução do projeto são gerenciadas através do Moonrepo:

```bash
# Desenvolvimento
moon run backend:dev        # Inicia API NestJS (compila shared previamente)
moon run frontend:dev       # Inicia SPA React no Vite
moon run mobile:start       # Inicia ambiente Expo DevTools

# Banco de dados e migrações
moon run backend:migration-run   # Aplica migrações pendentes no banco local
moon run backend:db-seed         # Popula o banco local com dados iniciais

# Testes e validações
moon run :test --affected   # Executa testes apenas nos projetos modificados pela branch
moon check --affected       # Checagem de tipos e lint nos arquivos alterados
moon run backend:test-bdd   # Executa especificação viva BDD com Cucumber
moon run :build             # Compila todos os workspaces na ordem correta do grafo
moon ci                     # Pipeline completo de validação contínua local
```

Para mais detalhes sobre padrões de código, arquitetura e fluxo de trabalho, consulte o [CONTRIBUTING.md](./CONTRIBUTING.md).

---

## 7. Autores

<div align="center">
    <table>
        <tr>
            <td align="center">
                <b>Principal Engineer</b><br />
                <a href="https://github.com/jh-ecomp?tab=repositories">
                    <img style="border-radius: 50%;" src="https://avatars.githubusercontent.com/u/21336271?s=400&u=4b4ff916cafb59709adaa958f3c0f46bed35ae62&v=4" width="100px;" alt="João Henrique"/>
                    <br />
                    <sub><b>João Henrique</b></sub>
                </a><a href="https://www.linkedin.com/in/joaohenrique-de/">[in]</a>
            </td>
            <td align="center">
                <b>Backend Software Engineer</b><br />
                <a href="https://github.com/IvoBruno?tab=repositories">
                    <img style="border-radius: 50%;" src="https://avatars.githubusercontent.com/u/129100295?v=4" width="100px;" alt="Ivo Bruno"/>
                    <br />
                    <sub><b>Ivo Bruno</b></sub>
                </a><a href="https://www.linkedin.com/in/ivobrunoaraujo/">[in]</a>
            </td>
            <td align="center">
                <b>Backend Software Engineer</b><br />
                <a href="https://github.com/jvalentim-tech?tab=repositories">
                    <img style="border-radius: 50%;" src="https://media.licdn.com/dms/image/v2/D4E03AQE5534NTUlzrQ/profile-displayphoto-scale_400_400/B4EZzaTpGoHkAk-/0/1773189109061?e=1788393600&v=beta&t=crfEEn7ACIGNIO6aLGm0Rx0kp3iFbMicALijJH2d0vw" width="100px;" alt="Jonas Valentim"/><br />
                    <sub><b>Jonas Valentim</b></sub>
                </a><a href="https://www.linkedin.com/in/jonasvalentim021/">[in]</a>
            </td>
        </tr>
        <tr>
            <td align="center">
                <b>Frontend Software Engineer</b><br />
                <a href="https://github.com/kauanalmeidadev?tab=repositories">
                    <img style="border-radius: 50%;" src="https://avatars.githubusercontent.com/u/253592579?v=4" width="100px;" alt="Kauan Brito"/><br />
                    <sub><b>Kauan Brito</b></sub>
                </a><a href="https://www.linkedin.com/in/kauan-almeida/">[in]</a>
            </td>
            <td align="center">
                <b>Backend Software Engineer</b><br />
                <a href="https://github.com/Franciscovieira-tech?tab=repositories">
                    <img style="border-radius: 50%;" src="https://avatars.githubusercontent.com/u/179271832?v=4" width="100px;" alt="Francisco Vieira"/><br />
                    <sub><b>Francisco Vieira</b></sub>
                </a><a href="https://www.linkedin.com/in/francisco-vieira-847782378/">[in]</a>
            </td>
        </tr>
    </table>
</div>

---

## 8. Licença

Este projeto está sob a licença [GNU GPL v3](./LICENSE).
