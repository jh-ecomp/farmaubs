# Dispensação de Medicamentos (RF010, RF012, RF028, NF009, NF010, NF017)

## Visão geral do épico e história de usuário

> **Como** farmacêutico ou profissional de saúde da UBS,  
> **quero** um fluxo de dispensação com identificação obrigatória do paciente (CNS, CPF, nome completo e data de nascimento), sugestão automática de lotes por FEFO, controle de receitas de antimicrobianos, consulta de histórico e exportação em planilha (.xlsx),  
> **para que** o atendimento no balcão seja ágil e seguro, evitando uso duplicado de medicamentos e mantendo a baixa física de estoque e os registros de auditoria em dia (RF010, RF012, RF028).

---

## Escopo do épico

### Requisitos funcionais cobertos

Requisitos canônicos descritos em [farmaubs-requisitos.md](../../documento-requisitos/farmaubs-requisitos.md):

| RF | Descrição canônica | Histórias associadas |
| --- | --- | --- |
| RF010 | Registro de dispensa de medicamentos com lote FEFO e identificação do paciente | DI-01, DI-02, DI-03, DI-04, DI-06, DI-07, DI-08, DI-09 |
| RF012 | Consulta de histórico de dispensas por período, paciente e medicamento, com exportação tabular (.xlsx) | DI-05, DI-10 |
| RF028 | Rastreabilidade e log de auditoria operacional (estorno de dispensação com devolução ao lote) | DI-04, DI-05, DI-10 |

### Requisitos não funcionais cobertos

| NF | Descrição canônica | Histórias associadas |
| --- | --- | --- |
| NF009 | Menor privilégio e controle de acesso RBAC (Farmacêutico Responsável e Farmacêutico Residente) | Todas |
| NF010 | Performance operacional: tempo de resposta da busca e baixa de estoque < 500ms | DI-03, DI-04, DI-09 |
| NF015 | Isolamento de dados multi-tenancy por UBS/Município via RLS | DI-01, DI-02, DI-04, DI-05 |
| NF017 | Segurança de dados e LGPD: integridade e proteção de dados cadastrais dos pacientes | DI-01, DI-02, DI-06 |

### Registros de arquitetura aplicados (ADRs)

| ADR | Tema | Histórias associadas |
| --- | --- | --- |
| ADR-002 | Isolamento de escopo por UBS e Tenant RLS no PostgreSQL | DI-01, DI-02, DI-04, DI-05 |
| ADR-003 | Arquitetura Hexagonal no Backend | DI-02, DI-03, DI-04, DI-05 |
| ADR-006 | Controle de acesso RBAC (`FARMACEUTICO_RESPONSAVEL`, `FARMACEUTICO_RESIDENTE`, `GERENTE`) | Todas |
| ADR-007 | Rotas REST `/api/v1/*`, DTOs e Swagger | DI-02, DI-03, DI-04, DI-05 |
| ADR-011 | Frontend React 19, Vite e Tailwind CSS | DI-06, DI-07, DI-08, DI-09, DI-10 |
| ADR-013 | Gerenciamento de estado com Context API e TanStack Query | DI-06, DI-07, DI-09, DI-10 |
| ADR-015 | Transações atômicas ACID para baixa de estoque e estorno | DI-04, DI-05 |
| ADR-022 | Contratos de interface e DTOs compartilhados em `@farmaubs/shared` | Todas |
| ADR-030 | Pirâmide de testes BDD (Camadas A, B, C e D) | Todas |
| ADR-032 | Acessibilidade digital WCAG 2.1 AA | DI-06, DI-07, DI-08, DI-09, DI-10 |

---

## Diretrizes de negócio e decisões operacionais

1. Identificação obrigatória do paciente:
   - No momento da dispensa, quatro campos do paciente são obrigatórios: Cartão Nacional de Saúde (CNS com 15 dígitos), CPF (11 dígitos válidos), Nome Completo (mínimo de 3 caracteres) e Data de Nascimento (data válida no passado).
   - O sistema valida a unicidade pelo CPF/CNS no município e exibe o histórico recente de consumo para prevenir dispensas repetidas antes do ciclo de 30 dias.

2. Seleção de medicamentos sem leitor de código de barras no MVP:
   - A seleção dos itens é realizada por busca textual (nome comercial, princípio ativo ou forma farmacêutica) no catálogo. O suporte a leitor óptico fica planejado para fases seguintes.

3. Sugestão automática de lote por FEFO:
   - O sistema sugere primeiro o lote com data de vencimento mais próxima (First Expire, First Out). O operador pode selecionar outro lote disponível se houver necessidade justificada.

4. Receitas de antimicrobianos:
   - Medicamentos antimicrobianos exigem o preenchimento dos dados da receita médica (número do registro profissional do prescritor, UF e data da receita).

5. Baixa de estoque e histórico com exportação:
   - A confirmação da dispensa realiza baixa transacional imediata no saldo do lote.
   - O histórico apresenta filtro padrão para as dispensas de ontem e hoje (`D-1` e `D0`), além de intervalo customizado de datas e botão de exportação em planilha Excel (.xlsx).

---

## Backlog do épico

### Backend e fundação

| ID | Título | Testes | Depende de | Status |
| --- | --- | --- | --- | --- |
| [DI-01](./di-01-backend-migrations-schema-dispensacao.md) | Migrações do schema de dispensação (`pacientes`, `dispensacoes`, `dispensacao_itens` e movimentações) | B | AC-01 | ✅ Redigida |
| [DI-02](./di-02-backend-api-pacientes-cadastro-historico.md) | API de Pacientes: validação cadastral (CNS, CPF, nome e nascimento) e histórico de consumo | A, C | DI-01 | ✅ Redigida |
| [DI-03](./di-03-backend-api-dispensacao-busca-produtos-lotes-fefo.md) | API de Dispensação: busca textual de medicamentos e algoritmo FEFO | A, C | DI-01 | ✅ Redigida |
| [DI-04](./di-04-backend-api-efetivacao-transacao-baixa-estoque.md) | API de Efetivação: baixa transacional de estoque e validação de antimicrobianos | A, B, C | DI-01, DI-02, DI-03 | ✅ Redigida |
| [DI-05](./di-05-backend-api-historico-dispensas-filtro-ontem-hoje-exportacao-xlsx.md) | API de Histórico: filtro ontem/hoje, intervalo customizado e exportação em XLSX | A, C | DI-04 | ✅ Redigida |

### Frontend

| ID | Título | Testes | Depende de | Status |
| --- | --- | --- | --- | --- |
| [DI-06](./di-06-frontend-identificacao-paciente-formulario-historico.md) | Formulário de identificação do paciente (CNS, CPF, nome e nascimento) e histórico | D | DI-02 | ✅ Redigida |
| [DI-07](./di-07-frontend-busca-textual-medicamentos-seletor-lotes-fefo.md) | Busca textual de medicamentos e seleção de lote FEFO com avisos de dosagem | D | DI-03 | ✅ Redigida |
| [DI-08](./di-08-frontend-carrinho-receita-posologia-antimicrobianos.md) | Carrinho de dispensação: múltiplos itens, posologia e checagem de receita | D | DI-03, DI-07 | ✅ Redigida |
| [DI-09](./di-09-frontend-tela-principal-dispensacao-fechamento-atendimento.md) | Tela principal integrando identificação, produtos e baixa de estoque | D | DI-04, DI-06, DI-08 | ✅ Redigida |
| [DI-10](./di-10-frontend-painel-historico-dispensas-filtros-exportacao-xlsx.md) | Painel de histórico: visualização ontem/hoje, busca e exportação em XLSX | D | DI-05, DI-09 | ✅ Redigida |

---

## Critérios de conclusão do épico (DoD)

- [x] 10 histórias de usuário redigidas com critérios de aceite em Gherkin em português e contratos TypeScript.
- [ ] Schema de banco com migrações, chaves estrangeiras e isolamento multi-tenant por UBS via RLS.
- [ ] Validação cadastral completa de paciente no momento da dispensa (CNS, CPF, nome e data de nascimento).
- [ ] Algoritmo de sugestão de lotes por FEFO em tempo de execução.
- [ ] Validação obrigatória de dados de receita médica para antimicrobianos.
- [ ] Baixa transacional em banco de dados com registro imediato de movimentação de auditoria.
- [ ] Painel de histórico com filtro padrão ontem/hoje e download de relatório em formato Excel (.xlsx).
- [ ] Testes automatizados cobrindo as camadas A, B, C e D.
