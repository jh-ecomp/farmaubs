# DI-MOB-02 Busca Rápida de Medicamentos e Seletor de Lotes FEFO Mobile (RF010)

- **Épico**: Dispensação de Medicamentos
- **Camada**: Mobile (`apps/mobile`)
- **Requisitos Funcionais**: RF010 (Seleção de Medicamentos e Sugestão FEFO)
- **Requisitos Não-Funcionais**: NF001 (Microinterações Fluídas), NF002 (Ergonomia Touch), NF010 (Busca Rápida com Debounce)
- **ADRs Vinculadas**: ADR-006 (RBAC), ADR-007 (API REST), ADR-022 (Monorepo), ADR-034 (Workspace Mobile Expo), ADR-035 (Governança Monorepo)

---

## 1. História de Usuário

> **Como** farmacêutico ou atendente com smartphone na farmácia da UBS,  
> **quero** buscar medicamentos no catálogo municipal por busca textual ágil, visualizar o lote recomendado pelo método FEFO (First Expire, First Out) com opção de alternância manual para outro lote físico e alertas de índice terapêutico,  
> **para que** eu selecione os itens com segurança clínica e agilidade durante a dispensação em dispositivos móveis (RF010).

---

## 2. Regras de Negócio e Casos de Borda Mobile

1. **Busca Textual Otimizada para Teclado Virtual**:
   - Campo de busca com ícone de lupa e botão `X` de limpeza rápida.
   - Pesquisa disparada com debounce de 250ms, buscando por princípio ativo, nome comercial ou forma farmacêutica.
   - Resultados exibidos em lista com virtualização nativa (`<FlatList>`) para garantir 60fps mesmo com centenas de itens no catálogo.

2. **Destaque do Lote Sugerido (FEFO) e Seletor de Lotes**:
   - Ao selecionar um medicamento, o app consulta `GET /api/v1/dispensacao/medicamentos/:id/lotes-fefo`.
   - O lote com vencimento mais próximo é pré-selecionado automaticamente:
     - Badge verde de destaque: `[Sugerido pelo Sistema (FEFO)] Lote: XXX | Vence: DD/MM/AAAA | Saldo: XX un.`.
   - Toque em "Trocar Lote" abre um bottom-sheet nativo ou modal exibindo os demais lotes físicos da UBS com saldo > 0.

3. **Alertas Clínicos e de Validade no Mobile**:
   - Validade < 30 dias: Badge âmbar/laranja `⚠️ Vence em X dias`.
   - Medicamentos de Índice Terapêutico Estreito (Carbamazepina, Digoxina, Lítio, etc.): Card de aviso lilás/azul com texto de orientação posológica.
   - Lotes com saldo zerado: visualmente acinzentados e desabilitados para toque.

4. **Controle de Quantidade com Stepper Touch**:
   - Botões touch amplos de stepper (`-` e `+`) com área de toque mínima de 44x44pt para facilitar o uso com uma mão.
   - Atalhos rápidos em chips: `+10`, `+20`, `+30` (comprimidos).
   - Bloqueio imediato caso a quantidade solicitada exceda o saldo físico do lote selecionado.

---

## 3. Contratos de Dados e Tipagens (`@farmaubs/shared`)

### 3.1 Rotas Consumidas
- `GET /api/v1/dispensacao/medicamentos?busca={termo}`
- `GET /api/v1/dispensacao/medicamentos/:id/lotes-fefo`

### 3.2 Tipagens Compartilhadas (`packages/shared/src/dispensacao/catalogo.types.ts`)

```typescript
export interface MedicamentoBuscaDto {
  id: string;
  nomeComercial: string;
  principioAtivo: string;
  formaFarmaceutica: string;
  antimicrobiano: boolean;
  indiceTerapeuticoEstreito: boolean;
}

export interface LoteEstoqueDto {
  id: string;
  numeroLote: string;
  dataValidade: string;
  saldoDisponivel: number;
  diasAteVencimento: number;
  sugeridoFefo: boolean;
}

export interface SugestaoFefoResultado {
  medicamentoId: string;
  loteSugerido: LoteEstoqueDto;
  outrosLotes: LoteEstoqueDto[];
}
```

---

## 3.3 Estratégia de Integração e Independência de Ciclos (Mobile ↔ Frontend Web)

- **Contra-parte no Frontend Web**: `DI-07` (Busca textual de medicamentos e seletor de lotes FEFO com alertas).
- **Contratos Compartilhados (`@farmaubs/shared`)**:
  - `MedicamentoBuscaDto`, `LoteEstoqueDto`, `SugestaoFefoResultado`.
  - Funções puras: `calcularDiasAteVencimento(dataValidade)` e `obterCriticidadeValidade(dias)`.
- **Se o Frontend Web já implementou DI-07**:
  - O Mobile importa diretamente os DTOs e funções utilitárias de `@farmaubs/shared`, garantindo que a ordenação FEFO e as regras de cores de vencimento coincidam exatamente.
- **Se o Frontend Web ainda NÃO implementou DI-07**:
  - O desenvolvedor Mobile define e implementa a ordenação e cálculos de vencimento em `packages/shared/src/dispensacao/catalogo.types.ts` com testes Jest no monorepo, disponibilizando a lógica para consumo posterior pelo Frontend Web.

---

## 4. Critérios de Aceite Detalhados

- [ ] Campo de busca textual com cancelamento e feedback de carregamento (`ActivityIndicator`).
- [ ] Listagem de medicamentos em `<FlatList>` fluida com títulos destacados e tags de apresentação.
- [ ] Apresentação destacada do lote FEFO com opção de seleção de lotes alternativos com saldo.
- [ ] Alertas visuais nítidos para validade próxima (< 30 dias) e índice terapêutico estreito.
- [ ] Validador de quantidade impedindo digitação superior ao saldo físico em estoque.

---

## 5. Cenários de Teste (BDD / Gherkin)

```gherkin
# language: pt
Funcionalidade: Busca de Medicamentos e Seleção FEFO Mobile (DI-MOB-02 / RF010)

  Cenário: Sugestão automática do lote FEFO ao selecionar medicamento
    Dado que o farmacêutico pesquisa e toca no medicamento "Metformina 850mg"
    Quando os lotes da UBS forem carregados
    Então o lote com vencimento mais próximo deve vir marcado como sugestão do sistema
    E a quantidade inicial deve ser definida como 1 unidade

  Cenário: Troca manual de lote através de folha inferior (Bottom Sheet)
    Dado que o lote sugerido tem saldo de 10 unidades mas o profissional precisa de outro
    Quando tocar no botão "Trocar Lote"
    Então uma folha inferior deve listar todos os lotes com saldo positivo
    E ao tocar em um lote alternativo, a seleção deve ser atualizada

  Cenário: Bloqueio de inserção com quantidade superior ao estoque
    Dado que o lote selecionado possui 15 unidades de saldo
    Quando o profissional tentar adicionar 20 unidades
    Então o aplicativo deve emitir aviso de saldo insuficiente e impedir o avanço
```

---

## 6. Checklist de DoD e Aceitação

- [ ] Componente implementado com touch targets acessíveis (WCAG Mobile).
- [ ] Compartilhamento estrito dos DTOs de `@farmaubs/shared`.
- [ ] Testes de tipagem aprovados via `moon run mobile:typecheck`.
