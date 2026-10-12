# RE-05: Cabeçalho do Recebimento: Formulário do documento fiscal/guia CAF, seleção de origem e validações (RF008)

---

- **Épico**: Recebimento de Medicamentos (RF008, RF024, RF028, NF001, NF002)
- **Requisitos Funcionais**: RF008 (Registro de Recebimento — Documento, Origem e Data)
- **Requisitos Não-Funcionais**: NF001 (Interface Intuitiva e Ergonomia), NF002 (Design Responsivo)
- **ADRs Vinculadas**: ADR-011 (React 19 + Tailwind CSS), ADR-022 (`@farmaubs/shared`), ADR-030 (Pirâmide de Testes — Camada D), ADR-032 (Acessibilidade WCAG 2.1 AA), ADR-034 (Workspace Mobile Expo), ADR-035 (Governança e Orquestração com Moonrepo)

---

## Contexto & Problema

Na rotina da farmácia de uma UBS, o processo de recebimento de insumos se inicia com a conferência da documentação física anexada à carga: a Guia de Remessa da CAF Central de Parnaíba ou uma Nota Fiscal de compra direta. O farmacêutico precisa identificar de forma inequívoca o número desse documento e a instituição fornecedora para vincular todos os medicamentos descarregados àquela remessa.

Este componente compõe a parte superior do formulário de recebimento, fornecendo validação instantânea, máscara e preenchimento ergonômico para que o profissional não precise redigitar dados repetitivos em cada medicamento da mesma remessa.

---

## Escopo Técnico & Arquitetural

- **Camada**: D (Testes de Componentes / Frontend React).
- **Componente**: `apps/frontend/src/features/recebimento/components/CabecalhoRecebimentoForm.tsx`.
- **Gerenciamento de Estado**: React Hook Form com esquema de validação Zod.
- **Campos do Formulário**:
  1. `numeroDocumento`: String obrigatória (mínimo 2 caracteres), aceitando formatos alfanuméricos como `GUIA-CAF-2026/104` ou `MOD 06 2908 2026`.
  2. `tipoDocumento`: Select com opções pré-configuradas (padrão: `GUIA_CAF`).
  3. `fornecedorOrigem`: Select/autocomplete (padrão: `CAF Central - SMS Parnaíba`).
  4. `dataRecebimento`: Datepicker com hora (padrão: data/hora atual).
  5. `observacoes`: Textarea/input opcional para anotações do laudo ou estado das caixas.
- **Decisões Arquiteturais**: ADR-011 (React + Vite), ADR-032 (Acessibilidade WCAG 2.1 AA), ADR-034 (Mobile Expo), ADR-035 (Moonrepo).

### Compartilhamento Arquitetural com `@farmaubs/shared` e App Mobile (`apps/mobile` - RE-MOB-01)
- **Contratos e Enums Exportados em `packages/shared/src/recebimento/recebimento.types.ts`**:
  - `TipoDocumentoRecebimento`: Enum compartilhado (`GUIA_CAF`, `NOTA_FISCAL`, `REMESSA_DLOG`, `COMPRA_PREGAO`, `DOACAO`).
  - `CabecalhoRecebimentoDto`: `{ numeroDocumento: string; tipoDocumento: TipoDocumentoRecebimento; fornecedorOrigem: string; dataRecebimento: string; observacoes?: string }`.
  - `FornecedorInstitucionalDto`: `{ id: string; nome: string; cnpjOuCodigo?: string; padrao: boolean }`.
- **Paridade com Mobile**:
  - O aplicativo nativo (`apps/mobile` - história `RE-MOB-01`) consome exatamente o mesmo schema Zod e enum de tipos de documento de `@farmaubs/shared`, permitindo que o farmacêutico abra e preencha a guia diretamente na doca de descarregamento das caixas através do smartphone.
- **Diretrizes para Ciclos Independentes de Desenvolvimento**:
  - *Cenário A (Mobile já implementou RE-MOB-01)*: O Frontend Web importa diretamente `TipoDocumentoRecebimento`, `CabecalhoRecebimentoDto` e o schema de validação já publicados em `@farmaubs/shared`.
  - *Cenário B (Mobile ainda NÃO implementou RE-MOB-01)*: O Frontend Web publica os enums e interfaces em `packages/shared/src/recebimento/recebimento.types.ts`, deixando os dados do cabeçalho prontos para a tela nativa mobile.

---

## Critérios de Aceite (Gherkin BDD)

### Cenário 1: Preenchimento válido do cabeçalho com fornecedor padrão
```gherkin
Dado que o farmacêutico acessou a tela de "Recebimento de Medicamentos"
Quando o formulário for carregado
Então o campo "Origem / Fornecedor" deve estar pré-selecionado com "CAF Central - SMS Parnaíba"
E o campo "Tipo de Documento" deve estar com "Guia CAF"
E ao digitar "GUIA-CAF-2026/104" no campo "Nº Nota Fiscal / Guia CAF"
Então o formulário deve considerar o cabeçalho válido e pronto para inserção de itens
```

### Cenário 2: Validação de obrigatoriedade do número do documento
```gherkin
Dado que o usuário limpou o campo "Nº Nota Fiscal / Guia CAF"
Quando ele tentar avançar ou submeter o formulário
Então o campo deve exibir borda vermelha e mensagem de erro: "Informe o número do documento fiscal ou guia da CAF"
E o botão de submissão final deve permanecer desabilitado
```

### Cenário 3: Seleção de outros fornecedores institucionais
```gherkin
Dado que a carga é proveniente de doação estadual
Quando o farmacêutico selecionar "Secretaria Estadual de Saúde (SESAPI)" no campo de origem
Então o estado do formulário deve atualizar o fornecedor e manter o número do documento digitado
```

---

## Esquema de Validação (Zod no Frontend)

```typescript
import { z } from 'zod';

export const cabecalhoRecebimentoSchema = z.object({
  numeroDocumento: z
    .string()
    .trim()
    .min(2, 'O número da nota/guia deve conter pelo menos 2 caracteres')
    .max(100, 'Tamanho máximo de 100 caracteres excedido'),
  tipoDocumento: z.enum([
    'GUIA_CAF',
    'NOTA_FISCAL',
    'REMESSA_DLOG',
    'COMPRA_PREGAO',
    'DOACAO',
  ]),
  fornecedorOrigem: z
    .string()
    .trim()
    .min(3, 'Selecione ou informe a origem do fornecedor'),
  dataRecebimento: z.string().datetime({ message: 'Data e hora de recebimento inválidas' }),
  observacoes: z.string().max(500, 'Máximo de 500 caracteres').optional(),
});

export type CabecalhoRecebimentoFormData = z.infer<typeof cabecalhoRecebimentoSchema>;
```

---

## Regras de Interface e Acessibilidade (ADR-032)

1. **Rótulos Explícitos e IDs Únicos**: Todos os campos possuem `<label for="...">` correspondente ao `id` do `<input>` para total compatibilidade com leitores de tela.
2. **Atalhos e Foco Automático**: Ao carregar a página de recebimento, o cursor deve focar automaticamente no campo `Nº Nota Fiscal / Guia CAF` (`autoFocus`), permitindo início imediato da digitação.
3. **Persistência de Rascunho**: O cabeçalho preenchido não deve ser apagado caso o farmacêutico adicione ou remova itens na tabela de conferência ao lado.

---

## Definition of Done (DoD)

- [ ] Componente implementado com React Hook Form e Zod.
- [ ] Testes unitários de componente (Camada D) via Vitest e Testing Library validando renderização, mensagens de erro e preenchimento padrão.
- [ ] Validação de contraste e navegabilidade por teclado atendendo aos requisitos da ADR-032.
