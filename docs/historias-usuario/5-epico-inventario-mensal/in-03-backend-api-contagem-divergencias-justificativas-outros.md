# IN-03 feat(inventario): API de Contagem: Lançamento Físico por Lote, Cálculo de Divergências e Validação Estrita de Justificativas com "Outros"

---

- **Épico**: Inventário Mensal (RF009, RF011, RF013, RF014, RF021, RF028, NF001, NF002, NF003, NF005, NF007, NF008, NF009, NF015)
- **Requisitos Funcionais**: RF013 (Realizar Inventário Mensal), RF028 (Rastreabilidade e Log de Auditoria)
- **Requisitos Não-Funcionais**: NF005 (Persistência Contínua de Rascunho), NF007 (Cálculo de Divergências em Tempo Real), NF015 (Isolamento Multi-tenant via RLS)
- **ADRs Vinculadas**: ADR-002 / ADR-016 (Isolamento RLS por UBS), ADR-003 (Arquitetura Hexagonal), ADR-007 (Endpoints REST e DTOs), ADR-022 (`@farmaubs/shared`), ADR-030 (Pirâmide de Testes — Camadas A e C), ADR-034 (Clean Architecture Fullstack), ADR-035 (Monorepo Moonrepo)

---

## 1. História de usuário

> **Como** farmacêutico responsável ou residente da UBS,  
> **quero** registrar individualmente ou em lote as contagens físicas dos medicamentos nas prateleiras durante o ciclo ativo, calculando instantaneamente a divergência matemática e exigindo seleção obrigatória de motivo sanitário e justificativa detalhada (com suporte à opção "Outros" e campo descritivo livre) sempre que houver sobras ou faltas,  
> **para que** o mapa de conciliação do inventário seja preenchido com rigor técnico, impedindo que discrepâncias físicas fiquem sem justificativa legal (RF013, RF028).

---

## 2. Regras de negócio e casos de borda

1. **Cálculo da Divergência em Tempo Real**:
   - Para cada item conferido:
     $$\text{divergencia} = \text{quantidadeFisica} - \text{quantidadeTeorica}$$
   - Se $\text{divergencia} = 0$: a situação é regular; qualquer motivo ou justificativa previamente gravada é limpa.
   - Se $\text{divergencia} > 0$: sobra física apurada.
   - Se $\text{divergencia} < 0$: falta física apurada.
2. **Obrigatoriedade de Motivo e Justificativa em Divergências (RF013)**:
   - Se $\text{divergencia} \neq 0$, o preenchimento do campo `motivoDivergencia` e da `justificativaDivergencia` torna-se **mandatório**.
   - Catálogo de motivos aceitos:
     - `VALIDADE_VENCIDA`: Descarte ou segregação de lote expirado;
     - `AVARIA_QUEBRA`: Danos físicos em ampolas, frascos ou blisters na bancada;
     - `EXTRAVIO`: Falta física sem registro de dispensa;
     - `ERRO_DIGITACAO`: Equívoco de lançamento em plantão anterior;
     - `ERRO_CONFERENCIA_ENTRADA`: Divergência originada no recebimento da carga;
     - `DISPENSA_NAO_EFETIVADA`: Medicamento separado mas não retirado pelo paciente;
     - `ENTREGA_CAF_SEM_CONFERENCIA`: Entrega emergencial da CAF recebida sem conferência física imediata no momento da descarga;
     - `OUTROS`: Situações atípicas não enquadradas nas anteriores.
3. **Regra Específica para Motivo "Outros"**:
   - Caso o farmacêutico selecione o motivo `OUTROS`, o campo `justificativaDivergencia` exige obrigatoriamente um texto descritivo detalhado com **no mínimo 15 caracteres** (bloqueando textos vagos como "ajuste", "ok" ou "falta").
4. **Atualização em Lote para Autosave Incremental (NF005)**:
   - Suporte ao endpoint `PUT /api/v1/inventario/ciclos/:id/contagens-lote`, permitindo que o frontend sincronize múltiplos itens contados a cada 30 segundos, preservando o trabalho de conferência de bancada contra quedas de conexão ou energia.

---

## 3. Contratos de dados e Protocolo HTTP (DTOs)

### Endpoints REST
- `PUT /api/v1/inventario/ciclos/:id/itens/:itemId/contagem`: Atualização individual da contagem física e justificativa.
- `PUT /api/v1/inventario/ciclos/:id/contagens-lote`: Atualização em lote para autosave contínuo.
- `GET /api/v1/inventario/ciclos/:id/divergencias`: Listagem do mapa de conciliação filtrado por divergências.

### DTOs TypeScript (com class-validator)

```typescript
export class RegistrarContagemItemDto {
  @IsInt()
  @Min(0, { message: 'A quantidade física deve ser maior ou igual a zero' })
  quantidadeFisica: number;

  @IsOptional()
  @IsEnum([
    'VALIDADE_VENCIDA',
    'AVARIA_QUEBRA',
    'EXTRAVIO',
    'ERRO_DIGITACAO',
    'ERRO_CONFERENCIA_ENTRADA',
    'DISPENSA_NAO_EFETIVADA',
    'ENTREGA_CAF_SEM_CONFERENCIA',
    'OUTROS'
  ])
  motivoDivergencia?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  justificativaDivergencia?: string;
}

export class SincronizarContagensLoteDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ItemContagemLoteDto)
  itens: ItemContagemLoteDto[];
}

export class ItemContagemLoteDto {
  @IsUUID()
  itemId: string;

  @IsInt()
  @Min(0)
  quantidadeFisica: number;

  @IsOptional()
  @IsString()
  motivoDivergencia?: string;

  @IsOptional()
  @IsString()
  justificativaDivergencia?: string;
}
```

---

## 4. Escopo Técnico da implementação (Clean Architecture — ADR-034)

### 1. Pacote Compartilhado (`@farmaubs/shared`)
- **`src/contracts/inventario/contagem.types.ts`**: `SalvarContagemItemInputDTO`, `InventarioDivergenciaItemDTO`, enum `MotivoDivergenciaInventario` e schema Zod `justificarDivergenciaSchema`.
- **`src/domain/inventario/divergencia-helpers.ts`**: Funções puras `calcularDivergencia(teorico, fisico)` e `validarJustificativaOutros(motivo, texto)` (exigindo mínimo de 15 caracteres), compartilhadas com frontend e mobile.

### 2. Camada de Aplicação (`apps/backend/src/modules/inventario/application/`)
- **Use Cases**:
  - `salvar-contagem-item.use-case.ts`: Atualiza quantidade física, recalcula divergência matemática e aplica regras de validação sanitária via helpers de `@farmaubs/shared`.
  - `salvar-contagens-lote.use-case.ts`: Processa array de contagens em lote para autosave com atomicidade local.
  - `consultar-mapa-divergencias.use-case.ts`: Retorna itens do ciclo filtrados por pendência de justificativa, conformes ou divergentes.

### 3. Camada de Domínio (`apps/backend/src/modules/inventario/domain/`)
- **Entidades de Domínio**: `InventarioItem` (com métodos de cálculo de divergência e validação de estado).
- **Portas (Interfaces)**:
  - `inventario-itens.repository.port.ts`: Contratos `buscarPorId`, `atualizarContagemEJustificativa`, `atualizarEmLote` e `listarDivergenciasPorCiclo`.
- **Erros de Domínio**: `ItemInventarioNaoEncontradoException`, `JustificativaObrigatoriaException`, `TamanhoMinimoJustificativaException`.

### 4. Camada de Infraestrutura (`apps/backend/src/modules/inventario/infrastructure/`)
- **Adaptadores de Banco (`adapters/`)**:
  - `typeorm-inventario-itens.repository.ts`: Operações parametrizadas respeitando o isolamento do tenant.
- **Adaptadores de Entrada HTTP (`controllers/`)**:
  - `inventario-contagem.controller.ts`: Endpoints `PUT /itens/:itemId/contagem`, `PUT /contagens-lote` e `GET /divergencias`.

---

## 5. Cenários de teste em BDD (Gherkin — camada A e C)

```gherkin
# language: pt
Funcionalidade: Lançamento de Contagens e Gestão de Divergências (Camadas A e C)

  Cenário: Lançamento de contagem física com divergência e justificativa detalhada
    Dado que o item do ciclo possui saldo teórico de 90 unidades do lote "LT-ATENOLOL"
    Quando o farmacêutico enviar a contagem física com 30 unidades (falta de 60 unidades)
    E selecionar o motivo "ENTREGA_CAF_SEM_CONFERENCIA"
    E preencher a justificativa "Guia entregue fora do horario sem conferencia presencial do farmaceutico"
    Então a API deve retornar status 200 (OK)
    E o item deve registrar divergência de -60
    E o status do item deve constar como conferido e justificado

  Cenário: Rejeição de motivo "OUTROS" com justificativa descritiva insuficiente
    Dado que o farmacêutico apurou sobra de 5 frascos
    Quando ele enviar o motivo "OUTROS"
    E preencher a justificativa com apenas "sobra física" (12 caracteres)
    Então a API deve recusar com status 400 (Bad Request)
    E detalhar: "O motivo 'OUTROS' exige justificativa descritiva com no mínimo 15 caracteres"
```

---

## 6. Checklist de DoD e aceitação

- [ ] Endpoints implementados com validação condicional em classe DTO / validator personalizado.
- [ ] Testes unitários (Camada A) cobrindo regras de obrigatoriedade de justificativa em divergências e limite de 15 caracteres para "OUTROS".
- [ ] Testes E2E (Camada C) validando lançamentos individuais, em lote e consulta de mapa de divergências.
