## ADR-035 - Governança de Monorepo, Fronteiras de Dependência e Orquestração de Tarefas

### Status
🟢 Decidido e documentado — última atualização: 18/11/2026

### Contexto

Com a expansão da topologia do FarmaUBS para 3 aplicações (`apps/backend`, `apps/frontend`, `apps/mobile`) e pacotes compartilhados em `packages/`, o monorepo gerenciado puramente via scripts manuais no `package.json` corre o risco de:
1. Executar builds e suítes de testes desnecessárias em CI/CD quando apenas uma aplicação foi alterada (ex: rodar testes do backend quando apenas uma tela mobile foi modificada).
2. Rompimento de fronteiras arquiteturais (ex: um app cliente importar diretamente código privado de infraestrutura do backend em vez de usar `@farmaubs/shared`).
3. Ausência de pipeline paralelo e cache de tarefas locais e remotas.

Para viabilizar execução paralela, cache de tarefas e detecção automática de projetos afetados via Git, adota-se formalmente o **`moon` (`@moonrepo/cli`)** como orquestrador de tarefas do monorepo sobre os `pnpm` workspaces.

### Decisão

1. **Grafo Estrito de Dependências e Fronteiras:**
   - **`packages/shared`**: Camada folha sem dependência de nenhum `apps/*`. Exporta tipos, DTOs, validações Zod e regras de negócio puras.
   - **`apps/backend`**: Depende de `@farmaubs/shared`. Nunca deve ser importado por `apps/frontend` ou `apps/mobile`.
   - **`apps/frontend`**: Depende de `@farmaubs/shared` e tokens visuais. Não importa arquivos de `apps/backend` nem de `apps/mobile`.
   - **`apps/mobile`**: Depende de `@farmaubs/shared` e tokens visuais. Não importa arquivos de `apps/backend` nem de `apps/frontend`.
2. **Orquestração de Tarefas e Pipeline:**
   - Padronizar as tarefas nos workspaces com nomes unificados no ciclo de vida:
     - `build`: compilação/transpilação de cada pacote.
     - `test`: execução de testes unitários.
     - `test:bdd` ou `test:e2e`: testes de comportamento/integração.
     - `lint`: checagem estática de código.
   - Utilizar **`moon` (`@moonrepo/cli`)** como orquestrador principal (configurado em `.moon/workspace.yml`, `.moon/toolchain.yml` e `moon.yml` por projeto: `backend`, `frontend`, `mobile`, `shared`), combinado com `pnpm` workspaces, utilizando detecção de arquivos alterados (`moon run :task --affected`) nos fluxos locais e de CI (`ADR-024`).
3. **Isolamento de Configurações:**
   - Cada aplicação mantém seu próprio `tsconfig.json` ajustado para o seu ambiente alvo (Node 20+ no backend, DOM/ESNext no frontend, React Native/Hermes no mobile).

### Consequências

**Positivas:**
- Tempos de CI previsíveis e velozes através da execução seletiva de tarefas para áreas impactadas.
- Impossibilidade de vazamento de acoplamento indevido entre clientes (Web e Mobile) e a infraestrutura de servidor.
- Facilidade de adição de novos pacotes (ex.: `packages/tokens` ou `packages/api-client`) sem afetar as regras existentes.

**Negativas / Trade-offs:**
- Requer disciplina contínua de manter scripts do `package.json` e exportações de `packages/shared` alinhados com a topologia.

### Decisões relacionadas
- [[ADR-022|adr-022-organizacao-de-repositorios.md]] - Organização de repositórios
- [[ADR-033|adr-033-clean-architecture-pura-no-backend.md]] - Clean Architecture pura no backend
- [[ADR-034|adr-034-workspace-mobile-react-native-expo.md]] - Workspace Mobile com React Native (Expo)
