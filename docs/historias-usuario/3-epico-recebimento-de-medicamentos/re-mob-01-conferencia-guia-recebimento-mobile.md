# RE-MOB-01 Abertura e Conferência da Guia de Recebimento no App Mobile (RF008)

- **Épico**: Recebimento de Medicamentos
- **Camada**: Mobile (`apps/mobile`)
- **Requisitos Funcionais**: RF008 (Registro de Recebimento — Documento, Origem e Data)
- **Requisitos Não-Funcionais**: NF001 (Interface Intuitiva com Poucos Toques), NF002 (Ergonomia Mobile em Campo), NF003 (Idioma pt-BR)
- **ADRs Vinculadas**: ADR-006 (RBAC), ADR-007 (API REST), ADR-022 (Monorepo), ADR-034 (Workspace Mobile Expo), ADR-035 (Governança Monorepo)

---

## 1. História de Usuário

> **Como** farmacêutico ou operador de farmácia da UBS recebendo caixas de medicamentos na doca/portaria,  
> **quero** registrar os dados da Guia de Remessa da CAF ou Nota Fiscal diretamente no smartphone com seleção rápida de fornecedor e data/hora atual automática,  
> **para que** eu inicie a conferência física da carga no local de descarregamento sem depender de formulários em papel (RF008).

---

## 2. Regras de Negócio e Casos de Borda Mobile

1. **Campos do Cabeçalho com Teclados Nativos**:
   - `Número do Documento`: campo de texto obrigatório com suporte alfanumérico (ex.: `GUIA-2026/099`), mínimo 2 caracteres, com foco automático ao abrir a tela.
   - `Tipo de Documento`: seletor nativo em chips ou ActionSheet (`Guia CAF`, `Nota Fiscal`, `Remessa DLOG`, `Doação`). Valor padrão pré-selecionado: `Guia CAF`.
   - `Fornecedor / Origem`: seletor de lista rápida com valor padrão `CAF Central - SMS Parnaíba`.
   - `Data/Hora do Recebimento`: preenchida automaticamente com o momento atual, com opção de ajuste via DateTimePicker nativo.
   - `Observações de Recepção`: campo de texto opcional para avarias aparentes na carga.

2. **Fixação e Persistência do Cabeçalho**:
   - Uma vez preenchido o cabeçalho, um cartão compacto com o número da guia e fornecedor fica afixado no topo da tela, permitindo que o usuário avance para a inclusão e conferência de itens sem perder a referência da remessa.

3. **Validação de Entrada e Feedback Ergonômico**:
   - O botão "Prosseguir para Conferência de Medicamentos" só é habilitado após a validação do número do documento e tipo.

---

## 3. Contratos de Dados e Tipagens (`@farmaubs/shared`)

### 3.1 Tipagens Compartilhadas (`packages/shared/src/recebimento/recebimento.types.ts`)

```typescript
export enum TipoDocumentoRecebimento {
  GUIA_CAF = 'GUIA_CAF',
  NOTA_FISCAL = 'NOTA_FISCAL',
  REMESSA_DLOG = 'REMESSA_DLOG',
  COMPRA_PREGAO = 'COMPRA_PREGAO',
  DOACAO = 'DOACAO',
}

export interface CabecalhoRecebimentoDto {
  numeroDocumento: string;
  tipoDocumento: TipoDocumentoRecebimento;
  fornecedorOrigem: string;
  dataRecebimento: string;
  observacoes?: string;
}
```

---

## 3.2 Estratégia de Integração e Independência de Ciclos (Mobile ↔ Frontend Web)

- **Contra-parte no Frontend Web**: `RE-05` (Cabeçalho do recebimento: formulário de guia CAF/documento, origem e validações).
- **Contratos Compartilhados (`@farmaubs/shared`)**:
  - `TipoDocumentoRecebimento`, `CabecalhoRecebimentoDto`, `FornecedorInstitucionalDto`.
- **Se o Frontend Web já implementou RE-05**:
  - O Mobile utiliza o mesmo enum `TipoDocumentoRecebimento` e os mesmos nomes de propriedades no payload de cabeçalho, garantindo interoperabilidade total.
- **Se o Frontend Web ainda NÃO implementou RE-05**:
  - O desenvolvedor Mobile define os enums e DTOs de cabeçalho em `packages/shared/src/recebimento/recebimento.types.ts`, servindo como fonte da verdade para o desenvolvimento do formulário web.

---

## 4. Critérios de Aceite Detalhados

- [ ] Campo de número do documento com validação de preenchimento mínimo (>= 2 caracteres).
- [ ] Tipo de documento pré-selecionado como "Guia CAF" e fornecedor como "CAF Central - SMS Parnaíba".
- [ ] Teclado adaptativo no mobile sem sobrepor o botão de prosseguir.
- [ ] Validações e enums importados diretamente de `@farmaubs/shared`.

---

## 5. Cenários de Teste (BDD / Gherkin)

```gherkin
# language: pt
Funcionalidade: Abertura de Guia de Recebimento Mobile (RE-MOB-01 / RF008)

  Cenário: Carga inicial da tela com valores institucionais padrão
    Dado que o farmacêutico abre o fluxo de recebimento no celular
    Quando a tela de abertura for exibida
    Então o fornecedor padrão deve ser "CAF Central - SMS Parnaíba"
    E o tipo de documento deve ser "Guia CAF"
    E a data/hora deve refletir o instante atual

  Cenário: Validação de número de documento obrigatório
    Dado que o campo de número do documento está em branco
    Quando o usuário tentar avançar para a conferência física
    Então o campo deve exibir destaque visual de erro
    E o botão de avanço deve permanecer bloqueado
```

---

## 6. Checklist de DoD e Aceitação

- [ ] Tela desenvolvida com React Native e `@farmaubs/shared`.
- [ ] Tipos e enums validados via `moon run mobile:typecheck`.
