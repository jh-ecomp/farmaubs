## ADR-034 - Inclusão do Workspace Mobile com React Native (Expo) e Estratégia de Compartilhamento UI

### Status
🟢 Decidido e documentado — 03/10/2026

### Contexto

O FarmaUBS foi inicialmente concebido com um cliente web em React + Vite (`apps/frontend`, ADR-011). No entanto, o fluxo de operação nas Unidades Básicas de Saúde (UBSs) e almoxarifados centrais frequentemente exige mobilidade física (ex.: farmacêuticos em conferência de armários, agentes comunitários verificando estoques ou realizadores de inventário com leitura de código de barras).

Para viabilizar essa demanda, é necessário introduzir uma aplicação móvel (`apps/mobile`) no monorepo, consumindo a mesma API REST do backend (ADR-007) e preservando a experiência de autenticação e permissões (ADR-006).

Surge a decisão técnica sobre:
1. Framework e toolchain do aplicativo móvel.
2. Nível de compartilhamento de componentes entre Web e Mobile (`apps/frontend` vs `apps/mobile`).

#### Opções de Compartilhamento de UI:
- **Opção A - Componentes Universais com Biblioteca Cross-Platform (Tamagui / Gluestack / React Native Web):**
  - Escrever todos os botões, cards e modais em um pacote compartilhado `packages/ui`.
  - Desvantagens: Exigiria reescrever do zero os componentes atuais do frontend web (que utilizam Tailwind e primitivos HTML do DOM: `<div>`, `<input>`, `<button>`), gerando alto retrabalho e risco de regressão.
- **Opção B - Compartilhamento de Lógica, Contratos e Design Tokens com Componentes Nativos Separados:**
  - Compartilhar contratos, DTOs e validações (`packages/shared`), cliente HTTP (`packages/api-client` ou hooks) e tokens de design (paleta de cores do SUS, tipografia e espaçamentos).
  - O desenvolvedor mobile implementa os componentes visuais utilizando primitivos nativos do React Native (`<View>`, `<Text>`, `<TouchableOpacity>`, `<TextInput>`).

### Decisão

1. **Framework Mobile: React Native com Expo (Managed Workflow)**:
   - Adotar **Expo** com TypeScript e SDK moderno no diretório `apps/mobile`.
   - Justificativas: Facilidade de setup, suporte a compilação local e EAS Build, excelente suporte a TypeScript e ecossistema maduro para leitor de câmera/código de barras, biometria e armazenamento seguro.
2. **Estratégia de Compartilhamento de UI:**
   - **Componentes Visuais Nativos:** Os componentes de UI do mobile serão escritos nativamente em React Native. Não haverá unificação forçada de JSX/DOM entre web e mobile neste momento.
   - **Camada Compartilhada:**
     - `@farmaubs/shared`: Tipos, enums de status, regras de validação (Zod) e DTOs de login e transações.
     - `packages/tokens` (ou `packages/ui-tokens`): Design tokens de cores institucionais do SUS/FarmaUBS, escalas de espaçamento e fontes.
     - Lógica de autenticação e chamadas HTTP: Contratos de cliente HTTP tipados.
3. **Segurança e Sessão no Mobile:**
   - Enquanto a Web adota Cookies HTTP-Only (ADR-029/ADR-030), no mobile o armazenamento de credenciais de refresh/sessão deve utilizar o armazenamento seguro de hardware do dispositivo via `expo-secure-store` (Keystore no Android e Keychain no iOS) com envio no header `Authorization: Bearer` ou gerenciamento de sessão via cookie em cookie jar nativo.

### Consequências

**Positivas:**
- O desenvolvedor mobile tem total flexibilidade para implementar UX nativa com fluidez de 60/120fps (gestos, teclado virtual, animações nativas, feedback tátil) sem lutar contra abstrações web vazadas.
- O frontend web permanece intacto, sem quebra de estilização com Tailwind/Vite.
- Zero duplicação de contratos de API e modelos de dados, pois ambos consom `@farmaubs/shared`.

**Negativas / Trade-offs:**
- O desenvolvedor mobile precisa escrever os componentes visuais correspondentes às telas existentes na web.
- Necessidade de manter dois conjuntos de componentes de tela (um web e um mobile), embora ambos sigam a mesma especificação funcional.

### Decisões relacionadas
- [[ADR-006|adr-006-modelo-de-autenticacao-e-autorizacao.md]] - Modelo de autenticação e autorização
- [[ADR-011|adr-011-framework-de-frontend.md]] - Framework de frontend
- [[ADR-022|adr-022-organizacao-de-repositorios.md]] - Organização de repositórios (Monorepo)
- [[ADR-033|adr-033-clean-architecture-pura-no-backend.md]] - Clean Architecture pura no backend
- [[ADR-035|adr-035-governanca-e-orquestracao-de-monorepo.md]] - Governança e orquestração do monorepo
