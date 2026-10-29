# Módulo de recebimento de medicamentos (`@farmaubs/backend`)

O módulo de Recebimento de Medicamentos gerencia a entrada de cargas físicas e guias de remessa (CAF Central, DLOG/MS e fornecedores), a conferência de lotes e validades, o catálogo de fabricantes e produtos REMUME, e a auditoria de movimentações com estorno justificado.

---

## 1. Responsabilidades

- **Catálogo de produtos e fabricantes:** Busca textual de medicamentos por nome comercial ou princípio ativo e gestão cadastral de laboratórios farmacêuticos.
- **Conferência e entrada de estoque:** Validação de guias CAF/notas fiscais, checagem sanitária de validade (bloqueio de vencidos e alerta de validade curta < 6 meses).
- **Consistência transacional:** Criação ou incremento atômico de saldo em `lotes` com lock pessimista (`SELECT ... FOR UPDATE`).
- **Livro-razão de estoque:** Gravação imutável de movimentação `ENTRADA_RECEBIMENTO` em `movimentacoes_estoque` com saldo anterior e posterior.
- **Histórico e relatórios:** Filtro temporal padrão (ontem e hoje) ou customizado, exportação de planilhas `.xlsx` via ExcelJS e dados para impressão de comprovante.
- **Estorno atômico:** Reversão de entrada com validação de saldo remanescente disponível no lote e justificativa textual mínima.

---

## 2. Endpoints expostos

| Método | Rota | Descrição |
| --- | --- | --- |
| `GET` | `/api/v1/catalogo/produtos` | Busca de medicamentos no catálogo REMUME com paginação |
| `GET` | `/api/v1/catalogo/fabricantes` | Listagem e busca de fabricantes por nome ou CNPJ |
| `POST` | `/api/v1/catalogo/fabricantes` | Cadastro de novos laboratórios fabricantes |
| `POST` | `/api/v1/recebimento/entradas` | Efetivação transacional de entrada física de estoque |
| `GET` | `/api/v1/recebimento/entradas` | Histórico com filtro de período (default: ontem e hoje) |
| `GET` | `/api/v1/recebimento/entradas/exportar-xlsx` | Download de planilha Excel (.xlsx) das entradas |
| `GET` | `/api/v1/recebimento/entradas/:id/comprovante` | Dados estruturados para impressão do Termo de Recebimento |
| `POST` | `/api/v1/recebimento/entradas/:id/estorno` | Estorno justificado com dedução atômica de saldo |

---

## 3. Entidades e tabelas relacionadas

- **`produtos`:** Catálogo de medicamentos essenciais.
- **`fabricantes`:** Laboratórios fornecedores.
- **`documentos_entrada`:** Cabeçalho do documento fiscal ou guia CAF da remessa.
- **`recebimento_itens`:** Linhas da guia conferida.
- **`lotes`:** Saldo ativo de cada lote na UBS.
- **`movimentacoes_estoque`:** Auditoria do livro-razão com tipo de movimentação e saldos.

---

## 4. Estrutura interna

```text
apps/backend/src/modules/recebimento/
├── recebimento.module.ts         # Providers NestJS e useFactory
├── api/
│   ├── controllers/              # CatalogoController, RecebimentoController, HistoricoRecebimentoController
│   └── dto/                      # CriarEntradaDto, EstornoDto, FiltrosQueryDto
├── application/
│   └── use-cases/                # EfetivarRecebimentoUseCase, ListarRecebimentosUseCase, EstornarRecebimentoUseCase, etc.
├── domain/
│   ├── entities/                 # DocumentoEntrada, Lote, Fabricante, Produto
│   ├── ports/                    # RecebimentoRepositoryPort, CatalogoRepositoryPort, GeradorPlanilhaPort
│   └── errors/                   # SaldoInsuficienteParaEstornoException, ValidadeInvalidaException
└── infrastructure/
    ├── adapters/                 # TypeOrmRecebimentoRepository, ExcelJsGeradorPlanilhaService
    └── persistence/              # Entidades TypeORM e migrações SQL
```
