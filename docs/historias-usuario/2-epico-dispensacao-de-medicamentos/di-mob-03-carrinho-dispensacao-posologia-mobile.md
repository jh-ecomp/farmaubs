# DI-MOB-03 Carrinho de Dispensação, Posologia e Validação de Antimicrobianos Mobile (RF010)

- **Épico**: Dispensação de Medicamentos
- **Camada**: Mobile (`apps/mobile`)
- **Requisitos Funcionais**: RF010 (Registro de Múltiplos Itens por Receita e Validação de Antimicrobianos)
- **Requisitos Não-Funcionais**: NF001 (Feedback Instantâneo), NF002 (Ergonomia Mobile), NF017 (Conformidade com Legislação Sanitária)
- **ADRs Vinculadas**: ADR-006 (RBAC), ADR-007 (API REST), ADR-022 (Monorepo), ADR-034 (Workspace Mobile Expo), ADR-035 (Governança Monorepo)

---

## 1. História de Usuário

> **Como** farmacêutico montando a receita na tela do aplicativo móvel,  
> **quero** gerenciar uma lista de medicamentos do atendimento atual, ajustar quantidades e posologias por item e validar a data da receita médica para antimicrobianos (bloqueio após 10 dias corridos),  
> **para que** o paciente receba todos os itens prescritos com instruções claras e o aplicativo impeça a entrega de antibióticos com receituário expirado (RF010).

---

## 2. Regras de Negócio e Casos de Borda Mobile

1. **Gestão dos Itens do Atendimento (Carrinho Mobile)**:
   - Apresentação em lista com cartões deslizáveis ou com botão de exclusão claro.
   - Cada item no carrinho exibe:
     - Nome comercial e princípio ativo;
     - Lote e data de validade com badge de status;
     - Stepper de quantidade (`+` / `-`);
     - Input de texto multilinhas para posologia (ex.: "1 cp a cada 8h por 5 dias");
     - Ação de exclusão com confirmação rápida.

2. **Detecção e Validação de Antimicrobianos no Celular**:
   - Se houver qualquer medicamento antimicrobiano na lista:
     - Um card de alerta azul surge no topo: `Receita contém antimicrobianos. Validade legal da prescrição: 10 dias corridos.`
     - O campo **"Data da Receita Médica"** torna-se obrigatório, abrindo o DateTimePicker nativo do iOS/Android ao toque.
     - Validação instantânea:
       - Se `diasDecorridos > 10`: Card de erro vermelho com ícone de bloqueio `❌ Receita médica vencida há X dias. Dispensação bloqueada pela legislação sanitária.` e desabilita o botão de finalizar.
       - Data futura: bloqueia a submissão com aviso de data inválida.

3. **Barra Fixa Inferior com Totalizadores**:
   - Rodapé fixo na tela acima da barra de navegação/SafeArea:
     - Total de itens distintos (ex.: "3 itens");
     - Soma total de unidades (ex.: "80 unidades");
     - Botão primário de ação "Revisar Atendimento" / "Avançar".

---

## 3. Contratos de Dados e Tipagens (`@farmaubs/shared`)

### 3.1 Tipagens Compartilhadas (`packages/shared/src/dispensacao/dispensacao.types.ts`)

```typescript
export interface ItemDispensacaoRequest {
  medicamentoId: string;
  loteId: string;
  quantidade: number;
  posologia: string;
}

export interface EfetivarDispensacaoRequest {
  pacienteId: string;
  dataReceita?: string;
  itens: ItemDispensacaoRequest[];
  observacoes?: string;
}
```

---

## 3.3 Estratégia de Integração e Independência de Ciclos (Mobile ↔ Frontend Web)

- **Contra-parte no Frontend Web**: `DI-08` (Carrinho de dispensação: múltiplos itens, posologia e receita de antimicrobianos).
- **Contratos Compartilhados (`@farmaubs/shared`)**:
  - `ItemDispensacaoRequest`, `EfetivarDispensacaoRequest`.
  - Funções puras: `validarReceitaAntimicrobiano(dataEmissao, dataReferencia)` e `calcularTotaisCarrinho(itens)`.
- **Se o Frontend Web já implementou DI-08**:
  - O Mobile utiliza exatamente a função `validarReceitaAntimicrobiano` de `@farmaubs/shared` para validação da regra de 10 dias da RDC 20/2011, assegurando consistência clínica entre web e celular.
- **Se o Frontend Web ainda NÃO implementou DI-08**:
  - O desenvolvedor Mobile define os contratos do carrinho e a lógica de validação de antimicrobianos em `packages/shared/src/dispensacao/dispensacao.types.ts` com testes unitários, permitindo que a equipe web consuma a lógica clínica pronta.

---

## 4. Critérios de Aceite Detalhados

- [ ] Suporte à adição de múltiplos medicamentos no atendimento sem travar a interface mobile.
- [ ] Edição de posologia por item com teclado adaptado para texto e caracteres especiais.
- [ ] Detecção de antimicrobianos exibindo seletor nativo de data da receita médica.
- [ ] Bloqueio automático de finalização caso a receita de antimicrobiano possua mais de 10 dias.
- [ ] Barra inferior fixa com totalizadores visíveis sem cobrir os campos da lista.

---

## 5. Cenários de Teste (BDD / Gherkin)

```gherkin
# language: pt
Funcionalidade: Carrinho de Dispensação e Antimicrobianos Mobile (DI-MOB-03 / RF010)

  Cenário: Inclusão de medicamento antimicrobiano exige data da receita
    Dado que o carrinho contém medicamentos comuns
    Quando o farmacêutico adicionar o item "Azitromicina 500mg"
    Então o seletor "Data da Receita Médica" deve ser exibido obrigatoriamente
    E o botão de avançar deve permanecer inativo até o preenchimento da data

  Cenário: Bloqueio de receita de antimicrobiano expirada há 12 dias
    Dado que a receita médica com antimicrobiano foi emitida há 12 dias
    Quando a data for selecionada no DateTimePicker
    Então o app deve emitir aviso de receita vencida em vermelho
    E a finalização da dispensação deve ser bloqueada

  Cenário: Atualização dinâmica do totalizador de unidades
    Dado que existem 2 medicamentos no carrinho com 30 unidades cada
    Quando o usuário alterar a quantidade de um deles para 40 unidades
    Então a barra inferior deve atualizar imediatamente o total para 70 unidades
```

---

## 6. Checklist de DoD e Aceitação

- [ ] Validador de receita de antimicrobianos consumido da biblioteca compartilhada `@farmaubs/shared`.
- [ ] Adaptação para dispositivos com telas estreitas (360dp) sem truncamento de valores.
- [ ] Testes de tipagem aprovados via `moon run mobile:typecheck`.
