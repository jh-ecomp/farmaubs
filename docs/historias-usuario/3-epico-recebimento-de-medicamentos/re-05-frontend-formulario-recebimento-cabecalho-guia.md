# RE-05 feat(recebimento): Cabeçalho do Recebimento: Formulário do documento fiscal/guia CAF, seleção de origem e validações (RF008)

---

- **Épico**: Recebimento de Medicamentos (RF008, RF024, RF028, NF001, NF002)
- **Requisitos Funcionais**: RF008 (Registro de Recebimento — Documento, Origem e Data)
- **Requisitos Não-Funcionais**: NF001 (Interface Intuitiva e Ergonomia), NF002 (Design Responsivo)
- **ADRs Vinculadas**: ADR-011 (React 19 + Tailwind CSS), ADR-022 (`@farmaubs/shared`), ADR-030 (Pirâmide de Testes — Camada D), ADR-032 (Acessibilidade WCAG 2.1 AA), ADR-034 (Workspace Mobile Expo), ADR-035 (Governança e Orquestração com Moonrepo)

---

## 1. História de usuário

> **Como** farmacêutico ou operador de farmácia da UBS,  
> **quero** registrar os dados de identificação do documento fiscal ou guia de remessa da CAF com preenchimento ágil, seleção rápida de origem e validação instantânea,  
> **para que** toda a remessa recebida fique formalmente associada ao seu fornecedor e número de controle antes da conferência dos medicamentos sem perda de tempo com digitações repetitivas (RF008).

---

## 2. Regras de negócio e casos de borda

1. **Identificação Obrigatória da Carga**:
   - O campo `numeroDocumento` é obrigatório (mínimo de 2 caracteres) e aceita formatos alfanuméricos comuns no SUS, tais como `GUIA-CAF-2026/104` ou `MOD 06 2908 2026`.
2. **Seleção de Origem / Fornecedor Padrão**:
   - Por padrão, o formulário inicializa pré-selecionado com o fornecedor institucional `"CAF Central - SMS Parnaíba"` e tipo `"GUIA_CAF"`, acelerando em mais de 80% as operações cotidianas.
3. **Data e Hora Automáticas com Ajuste Manual**:
   - A data/hora do recebimento é pré-preenchida com o momento atual do sistema, permitindo alteração manual para registros de cargas descarregadas no turno anterior.
4. **Persistência de Rascunho**:
   - O cabeçalho preenchido permanece íntegro no estado local da tela enquanto o farmacêutico adiciona, edita ou remove itens na tabela de conferência física ao lado.
5. **Acessibilidade e Ergonomia (ADR-032)**:
   - Foco automático no campo `numeroDocumento` (`autoFocus`) ao carregar a tela.
   - Todos os campos possuem `<label for="...">` associado ao `id` do `<input>` e mensagens de erro semânticas anunciadas por leitores de tela via `aria-describedby` e `aria-invalid`.

---

## 3. Contratos de dados e Protocolo HTTP (DTOs / Schemas Zod)

### Esquema de Validação Zod (`@farmaubs/shared` / Frontend)

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

## 4. Escopo Técnico da implementação (Clean Architecture — ADR-034)

- **Camada**: D (Testes de Componentes / Frontend React).
- **Componente**: `apps/frontend/src/features/recebimento/components/CabecalhoRecebimentoForm.tsx`.
- **Gerenciamento de Estado**: React Hook Form com esquema de validação Zod.
- **Campos do Formulário**:
  1. `numeroDocumento`: String obrigatória (mínimo 2 caracteres).
  2. `tipoDocumento`: Select com opções pré-configuradas (padrão: `GUIA_CAF`).
  3. `fornecedorOrigem`: Select/autocomplete (padrão: `CAF Central - SMS Parnaíba`).
  4. `dataRecebimento`: Datepicker com hora (padrão: data/hora atual).
  5. `observacoes`: Textarea/input opcional para anotações do laudo ou estado das caixas.

### Compartilhamento Arquitetural com `@farmaubs/shared` e App Mobile (`apps/mobile` - RE-MOB-01)
- **Contratos e Enums Exportados em `packages/shared/src/recebimento/recebimento.types.ts`**:
  - `TipoDocumentoRecebimento`: Enum compartilhado (`GUIA_CAF`, `NOTA_FISCAL`, `REMESSA_DLOG`, `COMPRA_PREGAO`, `DOACAO`).
  - `CabecalhoRecebimentoDto`: `{ numeroDocumento: string; tipoDocumento: TipoDocumentoRecebimento; fornecedorOrigem: string; dataRecebimento: string; observacoes?: string }`.
  - `FornecedorInstitucionalDto`: `{ id: string; nome: string; cnpjOuCodigo?: string; padrao: boolean }`.
- **Paridade com Mobile**:
  - O aplicativo nativo (`apps/mobile` - história `RE-MOB-01`) consome exatamente o mesmo schema Zod e enum de tipos de documento de `@farmaubs/shared`.

---

## 5. Cenários de teste em BDD (Gherkin — camada D)

```gherkin
# language: pt
Funcionalidade: Cabeçalho de Recebimento de Cargas (Camada D)

  Cenário: Preenchimento válido do cabeçalho com fornecedor padrão
    Dado que o farmacêutico acessou a tela de "Recebimento de Medicamentos"
    Quando o formulário for carregado
    Então o campo "Origem / Fornecedor" deve estar pré-selecionado com "CAF Central - SMS Parnaíba"
    E o campo "Tipo de Documento" deve estar com "Guia CAF"
    E ao digitar "GUIA-CAF-2026/104" no campo "Nº Nota Fiscal / Guia CAF"
    Então o formulário deve considerar o cabeçalho válido e pronto para inserção de itens

  Cenário: Validação de obrigatoriedade do número do documento
    Dado que o usuário limpou o campo "Nº Nota Fiscal / Guia CAF"
    Quando ele tentar avançar ou submeter o formulário
    Então o campo deve exibir borda vermelha e mensagem de erro: "Informe o número do documento fiscal ou guia da CAF"
    E o botão de submissão final deve permanecer desabilitado

  Cenário: Seleção de outros fornecedores institucionais
    Dado que a carga é proveniente de doação estadual
    Quando o farmacêutico selecionar "Secretaria Estadual de Saúde (SESAPI)" no campo de origem
    Então o estado do formulário deve atualizar o fornecedor e manter o número do documento digitado
```

---

## 6. Checklist de DoD e aceitação

- [ ] Componente implementado com React Hook Form e Zod.
- [ ] Testes unitários de componente (Camada D) via Vitest e Testing Library validando renderização, mensagens de erro e preenchimento padrão.
- [ ] Validação de contraste e navegabilidade por teclado atendendo aos requisitos da ADR-032.
- [ ] Tipos e enums importados ou exportados via `@farmaubs/shared`.
