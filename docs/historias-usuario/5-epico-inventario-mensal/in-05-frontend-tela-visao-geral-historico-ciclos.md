# IN-05: Tela de Visão Geral: Histórico de Inventários Realizados, Indicador de Ciclo Ativo e Acionamento de Novo Ciclo

---

- **Épico**: Inventário Mensal (RF009, RF011, RF013, RF014, RF021, RF028, NF001, NF002, NF003, NF005, NF007, NF008, NF009, NF015)
- **Requisitos Funcionais**: RF014 (Consultar Histórico de Inventários), RF021 (Relatório de Inventário Mensal)
- **Requisitos Não-Funcionais**: NF001 (Interface Intuitiva com Visão Geral Clara), NF002 (Design Responsivo), NF009 (RBAC para Farmacêutico e Gerente)
- **ADRs Vinculadas**: ADR-006 (RBAC), ADR-011 (React 19 + Tailwind CSS), ADR-013 (TanStack Query), ADR-022 (`@farmaubs/shared`), ADR-030 (Pirâmide de Testes — Camada D), ADR-032 (Acessibilidade WCAG 2.1 AA), ADR-034 (Clean Architecture Fullstack), ADR-035 (Monorepo Moonrepo)

---

## 1. História de Usuário

> **Como** farmacêutico responsável ou gerente da UBS,  
> **quero** acessar uma página inicial do módulo de inventário que exiba o estado do ciclo atualmente em andamento com barra de progresso das contagens, permita iniciar um novo ciclo quando oportuno e apresente a tabela com o histórico de inventários passados com links rápidos para a Ata Oficial e download de planilhas,  
> **para que** eu possa acompanhar os períodos de conferência da unidade e auditar atas homologadas anteriormente em poucos cliques (RF014, RF021).

---

## 2. Regras de Negócio e Casos de Borda

1. **Card Superior de Ciclo Ativo**:
   - Se a API indicar um ciclo com status `EM_ANDAMENTO`:
     - Exibe card de destaque com fundo suave azul/âmbar;
     - Apresenta: Número do Ciclo, Data de Início, Responsável pela abertura;
     - Barra de progresso visual com percentual (`%`) e contadores numéricos (ex: `78 de 120 itens contados`);
     - Badge com quantidade de divergências identificadas até o momento;
     - Botão de ação primária: `Continuar Contagem Física` (redireciona para a tela de contagem);
     - Botão secundário de apoio: `Cancelar Ciclo` (abre modal com justificativa obrigatória).

2. **Botão Iniciar Novo Inventário**:
   - Caso não exista ciclo ativo:
     - Botão em destaque: `+ Iniciar Novo Inventário Mensal`;
     - Ao clicar, abre modal de confirmação explicando que será capturado o snapshot dos saldos teóricos de todos os lotes ativos da UBS;
   - Caso já exista ciclo ativo: o botão permanece desabilitado ou oculto com tooltip explicativo: `"Já existe um ciclo de inventário em andamento nesta unidade"`.

3. **Tabela de Histórico de Inventários Passados (RF014)**:
   - Tabela paginada listando os ciclos homologados na unidade:
     - Coluna 1: Número do Ciclo & Mês de Referência;
     - Coluna 2: Número da Ata Oficial;
     - Coluna 3: Data de Homologação (DD/MM/AAAA);
     - Coluna 4: Farmacêutico Responsável;
     - Coluna 5: Balanço de Divergências (Total de Sobras e Faltas);
     - Coluna 6: Ações:
       - Botão `Visualizar Ata` (abre modal formatado para conferência e impressão);
       - Botão `📥 Exportar (.xlsx)` (download direto do relatório em planilha).

---

## 3. Escopo Técnico & Arquitetural

- **Camada**: D (Testes de Componentes e Páginas React).
- **Página / Componente Principal**: `apps/frontend/src/features/inventario/pages/InventarioVisaoGeralPage.tsx`.
- **Hooks & Integrações**:
  - `useCicloAtivo()`: Consumo de `GET /api/v1/inventario/ciclos/ativo`;
  - `useHistoricoCiclos(pagina)`: Consumo de `GET /api/v1/inventario/ciclos`;
  - `useIniciarCiclo()` e `useCancelarCiclo()`.

### Compartilhamento Arquitetural com @farmaubs/shared e App Mobile (apps/mobile - IN-MOB-01)
- **Contratos e DTOs Unificados**: Os tipos `InventarioCicloAtivoDTO`, `InventarioHistoricoItemDTO` e o enum `StatusCicloInventario` estão centralizados em `@farmaubs/shared/src/contracts/inventario/`.
- **Cálculo de Progresso e Métricas**: A função utilitária `calcularProgressoInventario(totalItens, itensContados)` é compartilhada com o app mobile para exibição idêntica de percentuais e indicadores.
- **Transposição Mobile**: No aplicativo mobile (**IN-MOB-01**), a tela apresenta um card em destaque com o status do ciclo ativo, barra de progresso e botão tátil direto para ir para a contagem cega nas prateleiras (`Continuar Contagem`).
- **Diretrizes para Ciclos Independentes de Desenvolvimento**:
  - *Cenário A (Mobile já implementou IN-MOB-01)*: O Frontend Web consome diretamente `InventarioCicloAtivoDTO`, `InventarioHistoricoItemDTO` e `calcularProgressoInventario` já consolidados em `@farmaubs/shared`.
  - *Cenário B (Mobile ainda NÃO implementou IN-MOB-01)*: O Frontend Web publica as tipagens de ciclo ativo e histórico em `packages/shared/src/contracts/inventario/`, acompanhadas da função pura de cálculo de progresso com testes unitários.

---

## 4. Critérios de Aceite (Gherkin BDD)

### Cenário 1: Visualização de ciclo em andamento com barra de progresso
```gherkin
Dado que existe um ciclo de inventário ativo na UBS com 50% dos itens conferidos
Quando a página de inventário for carregada
Então o card superior deve exibir a barra de progresso preenchida em 50%
E o botão "Continuar Contagem Física" deve estar disponível em destaque
E o botão de iniciar novo inventário deve estar desabilitado
```

### Cenário 2: Acionamento da abertura de novo ciclo quando não há ciclo ativo
```gherkin
Dado que não há nenhum ciclo em andamento na UBS
Quando o farmacêutico clicar em "Iniciar Novo Inventário Mensal"
E confirmar o diálogo de snapshot
Então a requisição de abertura deve ser enviada
E o usuário deve ser redirecionado para a tela de contagem física do novo ciclo
```

---

## 5. Definition of Done (DoD)

- [ ] Página implementada com Tailwind CSS, skeletons de carregamento e estado vazio amigável.
- [ ] Indicador de progresso com acessibilidade semântica (`role="progressbar"`, `aria-valuenow`, `aria-valuemin="0"`, `aria-valuemax="100"`).
- [ ] Testes de componentes (Camada D) validando alternância de estados (com ciclo ativo vs. sem ciclo ativo) e acionamento de modais.
