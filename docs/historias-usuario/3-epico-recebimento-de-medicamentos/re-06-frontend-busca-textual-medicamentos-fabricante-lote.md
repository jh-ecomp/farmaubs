# RE-06 feat(recebimento): Busca Textual no Catálogo, Fabricante Obrigatório, Lote e Validade com Alertas (RF008, RF024)

---

- **Épico**: Recebimento de Medicamentos (RF008, RF024, RF028, NF001, NF002, NF007)
- **Requisitos Funcionais**: RF008 (Registro de Medicamento, Fabricante, Lote e Validade), RF024 (Alerta de Validade Curta e Bloqueio de Vencidos)
- **Requisitos Não-Funcionais**: NF001 (Interface Intuitiva com Autocomplete), NF002 (Design Responsivo), NF007 (Tempo de Resposta Ágil na Busca Textual com Debounce)
- **ADRs Vinculadas**: ADR-011 (React 19 + Tailwind CSS), ADR-013 (TanStack Query), ADR-022 (`@farmaubs/shared`), ADR-030 (Pirâmide de Testes — Camada D), ADR-032 (Acessibilidade WCAG 2.1 AA), ADR-034 (Workspace Mobile Expo), ADR-035 (Governança e Orquestração com Moonrepo)

---

## 1. História de usuário

> **Como** farmacêutico ou operador de farmácia da UBS,  
> **quero** pesquisar medicamentos no catálogo por texto livre com resposta instantânea, vincular o fabricante do lote, conferir a data de validade com alerta preventivo e adicionar os itens com suas quantidades à remessa,  
> **para que** a conferência física das caixas na bancada ocorra com ergonomia e sem risco de inclusão de medicamentos vencidos ou dados incompletos de rastreabilidade sanitária (RF008, RF024).

---

## 2. Regras de negócio e casos de borda

1. **Autocomplete de Medicamentos sem Leitor de Código de Barras**:
   - Para o MVP 1, a seleção de medicamentos é realizada por busca textual com debounce de 300ms (`useDebounce`), exibindo nome comercial, princípio ativo, dosagem e forma farmacêutica.
2. **Fabricante / Laboratório Obrigatório**:
   - Cada lote registrado deve possuir obrigatoriamente um fabricante associado. Se o laboratório for novo, o operador pode cadastrá-lo rapidamente via modal sem perder o formulário em andamento.
3. **Bloqueio de Validade Passada**:
   - A data de validade deve ser estritamente futura (`validade > hoje`). Lotes vencidos são bloqueados na interface com mensagem explícita: `"A validade do lote deve ser estritamente futura"`.
4. **Alerta Visual de Validade Curta (< 180 dias)**:
   - Caso a data de validade expire em menos de 6 meses (180 dias), o formulário exibe um badge âmbar de atenção: `"Atenção: lote com validade inferior a 6 meses"`. A inclusão é permitida com destaque visual.
5. **Quantidade Inteira Positiva**:
   - O campo de quantidade aceita apenas números inteiros maiores que zero (`quantidadeRecebida >= 1`).
6. **Ergonomia e Teclado (ADR-032)**:
   - Permite navegação pelas opções do autocomplete com as setas `Cima`/`Baixo` e seleção com `Enter`. Botão de limpeza ("X") para resetar o campo com 1 clique.

---

## 3. Contratos de dados e Protocolo HTTP (DTOs / Schemas Zod)

### Esquema de Validação Zod (`@farmaubs/shared` / Frontend)

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

## 4. Escopo Técnico da implementação (Clean Architecture — ADR-034)

- **Camada**: D (Testes de Componentes / Frontend React).
- **Componente**: `apps/frontend/src/features/recebimento/components/ItemRecebimentoForm.tsx`.
- **Hooks & Integrações**:
  - `useBuscaCatalogo(termo)`: Hook React Query consumindo `GET /api/v1/catalogo/produtos/busca`.
  - `useFabricantes()`: Hook React Query consumindo `GET /api/v1/catalogo/fabricantes`.
- **Campos do Componente**:
  1. `recMedSearchInput`: Campo textual com autocomplete dropdown.
  2. `fabricanteId`: Dropdown de seleção de fabricante com botão modal para adicionar novo laboratório.
  3. `recBatchNumber`: Input alfanumérico para digitação do lote impresso na caixa.
  4. `recExpiryDate`: Datepicker para data de validade com trava para datas expiradas.
  5. `recQuantity`: Input numérico inteiro positivo (> 0).

### Compartilhamento Arquitetural com `@farmaubs/shared` e App Mobile (`apps/mobile` - RE-MOB-02)
- **Contratos Exportados em `packages/shared/src/recebimento/catalogo-recebimento.types.ts`**:
  - `ItemConferenciaRecebimentoDto`, `FabricanteDto`, `CriarFabricanteRapidoRequest`.
- **Funções Puras**:
  - `classificarValidadeRecebimento(dataValidade: string): 'ACEITA' | 'ALERTA_6_MESES' | 'RECUSADA_VENCIDA'`.

---

## 5. Cenários de teste em BDD (Gherkin — camada D)

```gherkin
# language: pt
Funcionalidade: Inclusão de Medicamentos, Lote e Validade (Camada D)

  Cenário: Seleção de medicamento via autocomplete e preenchimento completo do lote
    Dado que o farmacêutico está no formulário de inclusão de item de recebimento
    Quando ele digitar "paracetamol" no campo de busca do medicamento
    Então o dropdown deve listar os medicamentos correspondentes (ex: "Paracetamol 500mg - Comprimido")
    E ao clicar no item desejado, o medicamento deve ser selecionado
    E os campos de "Fabricante", "Lote", "Data de Validade" e "Quantidade" devem ser habilitados para edição
    E ao selecionar "Prati-Donaduzzi", informar lote "LT-8812", validade "2027-12-31" e quantidade 400
    Então o botão "Adicionar à Remessa" deve ficar habilitado

  Cenário: Alerta visual para lotes com validade curta (< 180 dias)
    Dado que o farmacêutico está registrando um lote cuja validade expira em 90 dias a partir da data atual
    Quando ele preencher o campo "Data de Validade"
    Então um badge de alerta em tom âmbar deve surgir abaixo do campo: "Atenção: lote com validade inferior a 6 meses"
    E a inclusão do item deve ser permitida, porém destacada visualmente

  Cenário: Bloqueio de datas de validade expiradas (passadas)
    Dado que o farmacêutico digita uma data de validade correspondente a ontem ou ao mês passado
    Quando o campo de data de validade perder o foco
    Então o formulário deve exibir mensagem de erro: "A data de validade deve ser futura"
    E o botão de adicionar item deve permanecer desabilitado

  Cenário: Cadastro rápido de fabricante sem perder os dados já preenchidos
    Dado que o medicamento recebido é de um fabricante recém-homologado que ainda não consta na lista
    Quando o usuário clicar no botão "+ Novo Fabricante"
    Então um modal leve deve ser aberto sobre a tela
    E ao preencher a razão social "Laboratório Globo S/A" e confirmar
    Então o fabricante deve ser salvo na API e imediatamente selecionado no formulário sem limpar os outros campos
```

---

## 6. Checklist de DoD e aceitação

- [ ] Componente implementado com busca textual integrada ao TanStack Query com debounce.
- [ ] Validação estrita de data futura e quantidade inteira positiva.
- [ ] Testes unitários (Camada D) validando seleção no combobox, cálculo do badge de validade curta e submissão do item.
- [ ] Modal de cadastro rápido de fabricante implementado e acessível.
