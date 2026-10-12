# RE-06: Busca Textual no Catálogo, Fabricante Obrigatório, Lote e Validade com Alertas (RF008, RF024)

---

- **Épico**: Recebimento de Medicamentos (RF008, RF024, RF028, NF001, NF002, NF007)
- **Requisitos Funcionais**: RF008 (Registro de Medicamento, Fabricante, Lote e Validade), RF024 (Alerta de Validade Curta e Bloqueio de Vencidos)
- **Requisitos Não-Funcionais**: NF001 (Interface Intuitiva com Autocomplete), NF002 (Design Responsivo), NF007 (Tempo de Resposta Ágil na Busca Textual com Debounce)
- **ADRs Vinculadas**: ADR-011 (React 19 + Tailwind CSS), ADR-013 (TanStack Query), ADR-022 (`@farmaubs/shared`), ADR-030 (Pirâmide de Testes — Camada D), ADR-032 (Acessibilidade WCAG 2.1 AA), ADR-034 (Workspace Mobile Expo), ADR-035 (Governança e Orquestração com Moonrepo)

---

## Contexto & Problema

Durante a conferência das caixas de medicamentos na bancada da farmácia, o operador precisa registrar item a item os medicamentos da remessa. Como definido para o MVP 1, **o leitor de código de barras não será utilizado**, exigindo um componente de autocomplete textual altamente eficiente, que filtre medicamentos do catálogo à medida que o usuário digita.

Além disso, conforme destacado na entrevista com os farmacêuticos de Parnaíba, a rastreabilidade sanitária depende obrigatoriamente da associação de cada medicamento com o seu **Fabricante / Laboratório** (ex: EMS, Prati-Donaduzzi, Medley, Fiocruz), além do **Lote** e **Data de Validade** com alerta visual preventivo de validade curta.

---

## Escopo Técnico & Arquitetural

- **Camada**: D (Testes de Componentes / Frontend React).
- **Componente**: `apps/frontend/src/features/recebimento/components/ItemRecebimentoForm.tsx`.
- **Hooks & Integrações**:
  - `useBuscaCatalogo(termo)`: Hook React Query consumindo `GET /api/v1/catalogo/produtos/busca`.
  - `useFabricantes()`: Hook React Query consumindo `GET /api/v1/catalogo/fabricantes`.
- **Campos do Componente**:
  1. `recMedSearchInput`: Campo textual com autocomplete dropdown exibindo nome comercial, princípio ativo, dosagem e forma farmacêutica.
  2. `fabricanteId`: Dropdown de seleção de fabricante com botão modal para adicionar novo laboratório caso não listado.
  3. `recBatchNumber`: Input alfanumérico para digitação do lote impresso na caixa.
  4. `recExpiryDate`: Datepicker para data de validade com trava para datas expiradas.
  5. `recQuantity`: Input numérico inteiro positivo (> 0).
- **Decisões Arquiteturais**: ADR-011 (React + Vite), ADR-013 (TanStack Query), ADR-032 (Acessibilidade WCAG 2.1 AA), ADR-034 (Mobile Expo), ADR-035 (Moonrepo).

### Compartilhamento Arquitetural com `@farmaubs/shared` e App Mobile (`apps/mobile` - RE-MOB-02)
- **Contratos Exportados em `packages/shared/src/recebimento/catalogo-recebimento.types.ts`**:
  - `ItemConferenciaRecebimentoDto`: `{ produtoId: string; produtoNome: string; fabricanteId: string; fabricanteNome: string; numeroLote: string; dataValidade: string; quantidade: number }`.
  - `FabricanteDto`: `{ id: string; nome: string; ativo: boolean }`.
  - `CriarFabricanteRapidoRequest`: `{ nome: string }`.
- **Validações Puras**:
  - Regra de validade mínima: `validarDataValidadeFutura(data: string): boolean`.
  - Classificação de validade de recebimento: `classificarValidadeRecebimento(dataValidade: string): 'ACEITA' | 'ALERTA_6_MESES' | 'RECUSADA_VENCIDA'`.
- **Paridade com Mobile**:
  - Tanto a Web quanto o Mobile (`apps/mobile` - `RE-MOB-02`) compartilham os mesmos contratos de dados e regras de validação sanitária de lote/validade, permitindo que a conferência física ocorra lado a lado com as caixas físicas abertas.
- **Diretrizes para Ciclos Independentes de Desenvolvimento**:
  - *Cenário A (Mobile já implementou RE-MOB-02)*: O Frontend Web consome diretamente `ItemConferenciaRecebimentoDto`, `FabricanteDto` e a função pura `classificarValidadeRecebimento` de `@farmaubs/shared`.
  - *Cenário B (Mobile ainda NÃO implementou RE-MOB-02)*: O Frontend Web publica essas tipagens e helpers em `packages/shared/src/recebimento/catalogo-recebimento.types.ts`, acompanhados de testes unitários para a regra de validade mínima.

---

## Critérios de Aceite (Gherkin BDD)

### Cenário 1: Seleção de medicamento via autocomplete e preenchimento completo do lote
```gherkin
Dado que o farmacêutico está no formulário de inclusão de item de recebimento
Quando ele digitar "paracetamol" no campo de busca do medicamento
Então o dropdown deve listar os medicamentos correspondentes (ex: "Paracetamol 500mg - Comprimido")
E ao clicar no item desejado, o medicamento deve ser selecionado
E os campos de "Fabricante", "Lote", "Data de Validade" e "Quantidade" devem ser habilitados para edição
E ao selecionar "Prati-Donaduzzi", informar lote "LT-8812", validade "2027-12-31" e quantidade 400
Então o botão "Adicionar à Remessa" deve ficar habilitado
```

### Cenário 2: Alerta visual para lotes com validade curta (< 180 dias)
```gherkin
Dado que o farmacêutico está registrando um lote cuja validade expira em 90 dias a partir da data atual
Quando ele preencher o campo "Data de Validade"
Então um badge de alerta em tom âmbar deve surgir abaixo do campo: "Atenção: lote com validade inferior a 6 meses"
E a inclusão do item deve ser permitida, porém destacada visualmente
```

### Cenário 3: Bloqueio de datas de validade expiradas (passadas)
```gherkin
Dado que o farmacêutico digita uma data de validade correspondente a ontem ou ao mês passado
Quando o campo de data de validade perder o foco
Então o formulário deve exibir mensagem de erro: "A data de validade deve ser futura"
E o botão de adicionar item deve permanecer desabilitado
```

### Cenário 4: Cadastro rápido de fabricante sem perder os dados já preenchidos
```gherkin
Dado que o medicamento recebido é de um fabricante recém-homologado que ainda não consta na lista
Quando o usuário clicar no botão "+ Novo Fabricante"
Então um modal leve deve ser aberto sobre a tela
E ao preencher a razão social "Laboratório Globo S/A" e confirmar
Então o fabricante deve ser salvo na API e imediatamente selecionado no formulário sem limpar os outros campos
```

---

## Esquema de Validação (Zod)

```typescript
import { z } from 'zod';

export const itemRecebimentoSchema = z.object({
  produtoId: z.string().uuid('Selecione um medicamento válido do catálogo'),
  produtoNome: z.string().min(1),
  fabricanteId: z.string().uuid('Selecione o laboratório/fabricante produtor'),
  numeroLote: z
    .string()
    .trim()
    .min(2, 'O número do lote deve ter pelo menos 2 caracteres')
    .max(60, 'Máximo de 60 caracteres'),
  dataValidade: z
    .string()
    .refine((val) => {
      const data = new Date(val);
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      return data > hoje;
    }, { message: 'A validade do lote deve ser estritamente futura' }),
  quantidadeRecebida: z
    .number({ invalid_type_error: 'Informe um número válido' })
    .int('A quantidade deve ser um número inteiro')
    .positive('A quantidade recebida deve ser maior que zero'),
  observacoes: z.string().max(300).optional(),
});

export type ItemRecebimentoFormData = z.infer<typeof itemRecebimentoSchema>;
```

---

## Regras de Interface e Ergonomia

1. **Limpeza do Seletor de Busca**: Ícone de "X" visível no input de medicamento para limpar a seleção e buscar outro produto com um único clique.
2. **Debounce na Busca**: O autocomplete deve disparar requisições ao backend somente após 300ms de pausa na digitação (`useDebounce`), evitando requisições excessivas.
3. **Navegação Fluida por Teclado**: O usuário pode navegar pelos resultados do dropdown usando as setas `Cima` / `Baixo` e selecionar com a tecla `Enter`.

---

## Definition of Done (DoD)

- [ ] Componente implementado com busca textual integrada ao TanStack Query.
- [ ] Validação estrita de data futura e quantidade inteira positiva.
- [ ] Testes unitários (Camada D) validando seleção no combobox, cálculo do badge de validade curta e submissão do item.
