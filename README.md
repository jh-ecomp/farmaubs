<h1 align="center">
   <a href="#"> FarmaUBS </a>
</h1>
<h3 align="center">
    Um gerenciador de estoque voltado para a realidade das UBSs de Parnaíba-PI
</h3>

<p align="center">
    <img alt="GitHub language count" src="https://img.shields.io/github/languages/count/jh-ecomp/farmaubs?color=%2304D361">
    <img alt="Repository size" src="https://img.shields.io/github/repo-size/jh-ecomp/farmaubs">
    <img alt="GitHub last commit" src="https://img.shields.io/github/last-commit/jh-ecomp/farmaubs">
    <img alt="License" src="https://img.shields.io/badge/license-GNU GPL 3-brightgreen">
</p>

#### Status: Done

## Summary

1. [Sobre](#1-sobre)
2. [Instalação](#2-instalação)
3. [Estrutura de pastas completa](#3-estrutura-de-pastas-completa)
4. [Como usar](#4-como-usar)
5. [Autores](#5-autores)
6. [Licença](#6-licença)

## 1. Sobre

O FarmaUBS é uma aplicação voltada para profissionais farmacêuticos e operadores de saúde que atuam nas farmácias públicas das Unidades Básicas de Saúde (UBS) de Parnaíba-Piauí. O sistema tem como objetivo central prover controle de estoque de medicamentos com rastreabilidade por lote e validade, previsão de demanda e indicadores operacionais, eliminando a dependência de planilhas manuais e reduzindo o desperdício por vencimento de medicamentos.

O projeto é estruturado como um **Monorepo com Clean Architecture** orientado pelo modelo do **moonrepo/moon**, suportando múltiplos clientes (Web e Mobile) alimentados pela mesma API central.

## 2. Instalação

A instalação do projeto FarmaUBS está documentada no arquivo `/docs/onboarding/kickoff.md`, juntamente com todos os pré-requisitos de sistema.

#### 2.1 Pré-requisitos do Sistema

- **Node.js:** Versão 22.x (LTS).
- **pnpm:** Versão 11.21.0 (`corepack enable pnpm`).
- **Docker Desktop:** Com backend WSL2 habilitado e funcional.
- **Git:** Configurado para o repositório FarmaUBS.
- **VS Code:** Recomendado com extensões para ESLint, Prettier e NestJS.

## 3. Estrutura de pastas completa

A árvore de diretórios abaixo reflete a organização do monorepo escalável, separando aplicações clientes, servidor, pacotes compartilhados e orquestração de tarefas:

```text
farmaubs/
├── .github/                # Workflows de CI/CD (ADR-024)
├── apps/                   # Aplicações do Monorepo
│   ├── backend/            # API NestJS (Clean Architecture Pura + Ports & Adapters + RLS)
│   ├── frontend/           # SPA Web (React 19 + Vite + Tailwind CSS + TanStack Query)
│   └── mobile/             # App Móvel (React Native + Expo SDK 52 + SecureStore)
├── packages/               # Pacotes compartilhados
│   └── shared/             # Contratos DTO, Schemas Zod, Enums e Regras de Negócio puras
├── infra/                  # Configurações de infraestrutura (ADR-023)
│   ├── nginx/              # Servidor web (Produção)
│   ├── docker-compose.yml  # Base comum
│   ├── docker-compose.dev.yml
│   └── docker-compose.prod.yml
├── docs/                   # Documentação arquitetural viva e histórias de usuário
│   ├── adrs/               # Registros de Decisões de Arquitetura (ADR-001 a ADR-035)
│   └── historias-usuario/  # Especificações funcionais em BDD/Gherkin
├── pnpm-workspace.yaml     # Topologia de workspaces do pnpm
└── README.md               # Documentação principal
```

---

#### 3.1 Arquitetura do Backend (Clean Architecture Pura — ADR-003, ADR-033)

O backend segue a **Clean Architecture** e o padrão **Ports & Adapters**, mantendo os Casos de Uso totalmente desacoplados de frameworks (zero decorators NestJS na regra de negócio). O NestJS atua puramente como adaptador de infraestrutura na borda:

```text
apps/backend/src/modules/<modulo>/
├── domain/                 # Regras puras, Entidades, Value Objects e Portas (Interfaces)
├── application/            # Casos de Uso puros (Classes TypeScript sem decorators)
└── infrastructure/         # Adaptadores (TypeORM, Postgres, Repositórios, Controllers)
```

---

#### 3.2 Arquitetura dos Clientes (Frontend Web & Mobile Expo — ADR-011, ADR-034)

- **Frontend (`apps/frontend`):** SPA React 19 + Vite voltada para desktop nas farmácias e almoxarifados.
- **Mobile (`apps/mobile`):** Aplicativo nativo em React Native com Expo, consumindo os mesmos contratos de `@farmaubs/shared` com armazenamento seguro em Keystore/Keychain via `expo-secure-store`.

## 4. Como usar

Gere os segredos:

```powershell
# 1. Gerar os segredos e preencher
# Copie .env.example para .env
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# cole a saída em SESSION_SECRET e ENCRYPTION_KEY, e defina POSTGRES_PASSWORD
```

Em seguida rode os comandos docker a partir da raiz do repositório:

```powershell
# 2. Subir a stack de dev (primeira vez constrói as imagens, demora alguns minutos)
docker compose -f infra/docker-compose.yml -f infra/docker-compose.dev.yml up -d
# Alternativamente use --force-recreate para obrigar a recriação dos containers do zero
docker compose -f infra/docker-compose.yml -f infra/docker-compose.dev.yml up -d --force-recreate

# 3. Acompanhar os logs dos serviços
docker compose -f infra/docker-compose.yml -f infra/docker-compose.dev.yml logs -f api # <escolha um: api/frontend/postgres>

# 4. Acompanhar saúde dos serviços
docker compose -f infra/docker-compose.yml -f infra/docker-compose.dev.yml ps

# 5. Derrubar infra (adicina a flag -v, ao final, para apagar os volumes - apagar os dados do Postgres)
docker compose -f infra/docker-compose.yml -f infra/docker-compose.dev.yml down

# 6. Caso precise restartar um serviço
docker compose -f infra/docker-compose.yml -f infra/docker-compose.dev.yml restart # <escolha um: api/frontend/postgres>
```

Acessos:

- API em http://localhost:3000/api/v1
- Swagger em http://localhost:3000/api/v1/docs
- Frontend em http://localhost:5173
- Mobile: `pnpm dev:mobile` (Expo DevTools)
- Postgres em localhost:5434.

## 5. Autores

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

## 6. Licença

Este projeto está sobre a licença [GNU GPL 3](./LICENSE).

