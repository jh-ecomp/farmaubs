# DI-08 feat(dispensacao): Carrinho de Dispensação: Múltiplos itens, campos de posologia e validação de receita de antimicrobianos

---

- **Épico**: Dispensação de Medicamentos (RF010, NF009, NF010)
- **Requisitos Funcionais**: RF010 (Registro de Múltiplos Itens por Receita e Validação de Antimicrobianos)
- **Requisitos Não-Funcionais**: NF001 (Feedback Instantâneo), NF017 (Conformidade com Legislação Sanitária de Receituário)
- **ADRs Vinculadas**: ADR-011 (React 19 + Tailwind CSS), ADR-022 (`@farmaubs/shared`), ADR-030 (Pirâmide de Testes — Camada D), ADR-032 (Acessibilidade WCAG 2.1 AA), ADR-034 (Workspace Mobile Expo), ADR-035 (Governança e Orquestração com Moonrepo)

---

## 1. História de usuário

> **Como** farmacêutico montando a receita na tela de atendimento da UBS,  
> **quero** adicionar múltiplos medicamentos em uma lista de atendimento (carrinho de dispensação), definir a posologia recomendada para cada um e registrar a data de emissão da receita médica com validação automática do prazo de validade de 10 dias para antimicrobianos,  
> **para que** o paciente receba todos os medicamentos prescritos em um único atendimento estruturado e o sistema impeça a entrega de antibióticos com receita médica expirada (RF010).

---

## 2. Regras de negócio e casos de borda

1. **Gestão do Carrinho da Receita (Múltiplos Itens)**:
   - A lista de atendimento permite adicionar de 1 a N medicamentos distintos.
   - Cada linha do carrinho exibe:
     - Nome do medicamento e apresentação;
     - Lote selecionado e data de validade;
     - Quantidade a dispensar (com botões de ajuste `+` / `-` e input manual);
     - Campo de texto para posologia (ex.: "1 comprimido de 12 em 12 horas por 7 dias");
     - Botão de remoção de item da lista com confirmação acessível.
   - Se o usuário tentar adicionar o mesmo medicamento com o mesmo lote novamente, o sistema incrementa a quantidade do item existente em vez de duplicar a linha.

2. **Detecção e Validação de Antimicrobianos**:
   - O sistema detecta automaticamente se qualquer um dos medicamentos adicionados ao carrinho é classificado como antimicrobiano (`antimicrobiano: true`).
   - Se houver ao menos um antimicrobiano:
     - O campo **"Data de Emissão da Receita Médica"** torna-se **visível e obrigatório**.
     - Um banner azul informa: `Prescrição contém antimicrobianos. Validade legal da receita: 10 dias corridos a partir da emissão.`
     - Ao informar a data, o componente calcula a diferença em dias em relação à data atual:
       - Se `diasDecorridos > 10`: Exibe alerta vermelho e bloqueia o botão de finalizar:  
         `❌ Receita médica vencida há X dias. O prazo legal para dispensação de antimicrobianos é de até 10 dias.`
       - Se a data informada for futura: Bloqueia a submissão com aviso de data inválida.

3. **Totalizadores do Atendimento**:
   - Exibe sumário inferior com o total de itens distintos e a soma total de unidades físicas a serem retiradas do estoque da UBS.

---

## 3. Contratos de dados e protocolo HTTP

### 3.1 Tipos Compartilhados (`packages/shared/src/dispensacao/dispensacao.types.ts`)
- Utiliza `ItemDispensacaoRequest` e `EfetivarDispensacaoRequest`.

### 3.2 Compartilhamento Arquitetural com `@farmaubs/shared` e App Mobile (`apps/mobile` - DI-MOB-03)
- **Contratos e Tipos Exportados em `packages/shared/src/dispensacao/dispensacao.types.ts`**:
  - `ItemDispensacaoRequest`: `{ medicamentoId: string; loteId: string; quantidade: number; posologia: string }`.
  - `EfetivarDispensacaoRequest`: `{ pacienteId: string; dataReceita?: string; itens: ItemDispensacaoRequest[]; observacoes?: string }`.
- **Regras Clínicas e Validações Puras**:
  - Validador legal de receita de antimicrobianos (`validarReceitaAntimicrobiano(dataEmissao: string, dataReferencia?: string): { valido: boolean; diasDecorridos: number; mensagem?: string }`).
  - Função utilitária de totalização de carrinho (`calcularTotaisCarrinho(itens: ItemDispensacaoRequest[]): { totalItens: number; totalUnidades: number }`).
- **Paridade com Mobile**:
  - A lógica de carrinho e checagem de antimicrobianos é idêntica na Web (`apps/frontend`) e no Mobile (`apps/mobile` - `DI-MOB-03`), operando como um hook puro alimentado pelas funções compartilhadas de `@farmaubs/shared`.
- **Diretrizes para Ciclos Independentes de Desenvolvimento**:
  - *Cenário A (Mobile já implementou DI-MOB-03)*: O Frontend Web reutiliza diretamente os contratos de `ItemDispensacaoRequest`, `EfetivarDispensacaoRequest` e a função `validarReceitaAntimicrobiano` de `@farmaubs/shared`.
  - *Cenário B (Mobile ainda NÃO implementou DI-MOB-03)*: O Frontend Web publica as regras clínicas de antimicrobianos (RDC 20/2011 - 10 dias) e contratos do carrinho em `packages/shared/src/dispensacao/dispensacao.types.ts`, acompanhadas de testes unitários que servirão de base para o app nativo.

---

## 4. Escopo Técnico da implementação

### Frontend (`apps/frontend/src/`)
- **`components/dispensacao/CarrinhoReceita.tsx`**:
  - Tabela responsiva de itens adicionados com campos de quantidade, lote e posologia.
- **`components/dispensacao/ValidacaoReceitaAntimicrobiano.tsx`**:
  - Seletor de data de emissão e cálculo em tempo real da validade de 10 dias.
- **`contexts/DispensacaoContext.tsx`**:
  - Estado global/local gerenciando paciente selecionado, itens no carrinho, data da receita e totais calculados.
- **Testes da Camada D**:
  - `components/dispensacao/CarrinhoReceita.spec.tsx`: Adição, alteração de posologia, remoção de itens e soma correta dos totais.
  - `components/dispensacao/ValidacaoReceitaAntimicrobiano.spec.tsx`: Bloqueio de submissão quando a receita de antimicrobiano possuir mais de 10 dias de emissão.

---

## 5. Cenários de teste em BDD (Gherkin — camada D)

```gherkin
# language: pt
Funcionalidade: Carrinho da Receita e Validação de Antimicrobianos (Camada D)

  Cenário: Adição de múltiplos medicamentos ao carrinho de atendimento
    Dado que o carrinho está vazio
    Quando o farmacêutico adicionar 30 comprimidos de "Losartana 50mg"
    E adicionar 20 comprimidos de "Hidroclorotiazida 25mg"
    Então o carrinho deve exibir exatamente 2 linhas de medicamentos
    E o totalizador de unidades deve exibir 50

  Cenário: Exigência da data de receita ao adicionar medicamento antimicrobiano
    Dado que o carrinho contém apenas medicamentos comuns
    Quando o farmacêutico adicionar o item "Amoxicilina 500mg"
    Então o campo "Data de Emissão da Receita" deve se tornar obrigatório
    E uma mensagem de orientação sobre o prazo de 10 dias deve ser exibida

  Cenário: Bloqueio do atendimento para receita de antimicrobiano emitida há 11 dias
    Dado que o carrinho contém o medicamento antimicrobiano "Cefalexina 500mg"
    Quando o farmacêutico selecionar uma data de emissão de 11 dias atrás
    Então uma mensagem de erro indicando receita expirada deve ser exibida
    E o botão de prosseguir para finalização deve ficar desabilitado
```

---

## 6. Checklist de DoD e aceitação

- [ ] Suporte à adição e remoção fluida de múltiplos itens no mesmo atendimento.
- [ ] Campo de posologia livre editável por medicamento.
- [ ] Regra de 10 dias para antimicrobianos validada no frontend impedindo avanço com receita vencida.
- [ ] Teclado e leitores de tela compatíveis com WCAG 2.1 AA.
- [ ] Testes automatizados da Camada D cobrindo cenários com e sem antimicrobianos.
