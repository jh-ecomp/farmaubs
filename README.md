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

O FarmaUBS é uma aplicação web voltada para profissionais farmacêuticos que atuam nas farmácias públicas das Unidades Básicas de Saúde (UBS) de Parnaíba-Piauí. O sistema tem como objetivo central prover controle de estoque de medicamentos com rastreabilidade por lote e validade, previsão de demanda e indicadores operacionais, eliminando a dependência de planilhas manuais e reduzindo o desperdício por vencimento de medicamentos.

## 2. Instalação

A instalação do projeto FarmaUBS está documentada no arquivo `/docs/onboarding/kickoff.md`, juntamente com todos os pré-requisitos de sistema.

#### 2.1 Pré-requisitos do Sistema

- **Node.js:** Versão 22.x (LTS).
- **pnpm:** Versão 11.21.0 (`corepack enable pnpm`).
- **Docker Desktop:** Com backend WSL2 habilitado e funcional.
- **Git:** Configurado para o repositório FarmaUBS.
- **VS Code:** Recomendado com extensões para ESLint, Prettier e NestJS.

## 3. Estrutura de pastas completa

A árvore de diretórios abaixo reflete a organização do monorepo, separando aplicações de pacotes compartilhados e configurações de infraestrutura.

```text
farmaubs/
├── .github/                # Workflows de CI/CD (ADR-024 - Futuro)
├── apps/                   # Aplicações principais
│   ├── backend/            # API NestJS (Hexagonal + Migrations)
│   └── frontend/           # SPA React + Vite
├── packages/               # Pacotes compartilhados
│   └── shared/             # Tipos, DTOs e constantes comuns
├── infra/                  # Configurações de infraestrutura (ADR-023)
│   ├── nginx/              # Configurações do servidor web (Produção)
│   │   └── frontend.conf
│   ├── docker-compose.yml  # Base comum
│   ├── docker-compose.dev.yml
│   └── docker-compose.prod.yml
├── .gitignore              # Regras de exclusão do Git
├── .npmrc                  # Configurações do pnpm
├── .env.example            # Modelo de variáveis de ambiente (ADR-027)
├── package.json            # Manifesto raiz do monorepo
├── pnpm-workspace.yaml     # Definição dos workspaces
└── README.md               # Documentação principal
```

---

#### 3.1 Estrutura Interna do Backend (Hexagonal — ADR-003)

O backend segue a Arquitetura Hexagonal, onde o domínio é isolado de tecnologias externas. O banco de dados e suas migrações são tratados como detalhes de implementação dentro da camada de infraestrutura.

```text
apps/backend/src/
├── main.ts                 # Ponto de entrada da aplicação
├── app.module.ts           # Módulo raiz
├── common/                 # Filtros, interceptors e decorators globais
└── modules/                # Módulos de domínio (Vertical Slicing)
    ├── acesso/             # Auth, RBAC, Usuários
    ├── medicamentos/       # Catálogo, RENAME, REMUME
    ├── estoque/            # Entradas e Saídas
    ├── inventario/         # Contagem e ajustes
    ├── pedidos/            # Requisições entre unidades
    ├── indicadores/        # Lógica de BI e KPIs
    ├── alertas/            # Notificações e gatilhos
    ├── relatorios/         # Geração de documentos
    └── administracao/      # Configurações do sistema
        ├── domain/         # Entidades e Regras de Negócio
        ├── application/    # Casos de Uso e Portas (Interfaces)
        ├── infrastructure/ # Adaptador de Repositório Oficial (TypeORM)
        │   ├── persistence/ # TypeORM (Escolha Definitiva - ADR-016/008), Repositories, Migrations
        │   │   ├── entities/
        │   │   └── migrations/
        └── api/            # Adaptadores de Entrada (Controllers, DTOs)
```

---

#### 3.2 Estrutura Interna do Frontend (React + Vite)

O frontend é organizado para suportar escalabilidade e o uso intensivo de estados assíncronos com TanStack Query.

```text
apps/frontend/src/
├── assets/                 # Imagens, ícones e fontes
├── components/             # Componentes reutilizáveis (UI/Common)
├── contexts/               # Provedores de contexto (Auth, Theme)
├── hooks/                  # Custom hooks lógicos
├── lib/                    # Configurações de libs (Axios, QueryClient)
├── pages/                  # Componentes de rota (Views)
├── services/               # Clientes de API (Consumo do Backend)
├── styles/                 # CSS Global e temas (Tailwind)
├── types/                  # Definições de tipos locais
├── App.tsx                 # Componente raiz e roteamento
└── main.tsx                # Ponto de montagem React
```

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

# 3. Acompanhar os logs da API
docker compose -f infra/docker-compose.yml -f infra/docker-compose.dev.yml logs -f api

# 4. Derrubar infra (adicina a flag -v, ao final, para apagar os volumes - apagar os dados do Postgres)
docker compose -f infra/docker-compose.yml -f infra/docker-compose.dev.yml down
```

Acessos:

- API em http://localhost:3000/api/v1
- Swagger em http://localhost:3000/api/docs (quando o @nestjs/swagger for configurado)
- Frontend em http://localhost:5173
- Postgres em localhost:5432.

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
            <td align="center">
                <b>Frontend Software Engineer</b><br />
                <a href="https://github.com/kauanalmeidadev?tab=repositories">
                    <img style="border-radius: 50%;" src="https://avatars.githubusercontent.com/u/253592579?v=4" width="100px;" alt="Kauan Brito"/><br />
                    <sub><b>Kauan Brito</b></sub>
                </a><a href="https://www.linkedin.com/in/kauan-almeida/">[in]</a>
            </td>
            <td align="center">
                <b>Project Manager</b><br />
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
