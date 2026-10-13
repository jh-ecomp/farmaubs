# Recebimento de Medicamentos (RF008, RF024, RF028, NF001, NF002, NF003, NF005, NF007, NF009, NF015)

## Visão geral do épico e história de usuário

> **Como** farmacêutico responsável ou operador de farmácia da UBS,  
> **quero** registrar a entrada física e a conferência de cargas de medicamentos entregues pela CAF, DLOG/Ministério da Saúde ou outros fornecedores, consultar o histórico com filtro padrão de ontem e hoje ou intervalo customizado, exportar os dados em planilha Excel (.xlsx), emitir o comprovante de recebimento e estornar entradas incorretas com justificativa,  
> **para que** o estoque da farmácia seja alimentado com rastreabilidade por lote, fabricante, apresentação e validade, mantendo o controle do abastecimento e os registros de auditoria em dia (RF008, RF024, RF028).

---

## Contexto operacional

Nas farmácias das UBS de Parnaíba-PI, os medicamentos chegam principalmente por guias da CAF Central (com identificação como `MOD 06 2908 2026` ou `GUIA-CAF-2026/104`), remessas do Ministério da Saúde (DLOG) e eventuais compras ou doações.

Muitas vezes essa conferência é feita em papel ou planilhas separadas, gerando atraso na atualização das prateleiras, erros ao digitar lotes e diferença entre o que está guardado e o que consta no sistema.

O módulo de recebimento permite que o profissional faça essa conferência na tela, registrando cada item com fabricante, lote, data de validade e quantidade recebida. A entrada vincula os itens ao documento fiscal ou guia e atualiza o saldo da farmácia.

---

## Escopo do épico

### Requisitos funcionais cobertos

Requisitos canônicos descritos em [farmaubs-requisitos.md](../../documento-requisitos/farmaubs-requisitos.md):

| RF | Descrição canônica | Histórias associadas |
| --- | --- | --- |
| RF008 | Registrar Recebimento de Medicamentos: registro da entrada enviada por CAF/fornecedores com lote, validade, quantidade e atualização de estoque no histórico. | RE-01, RE-02, RE-03, RE-05, RE-06, RE-07 |
| RF024 | Alertar Recebimento de Medicamentos com Validade Curta: aviso ao registrar lote com validade abaixo de 6 meses, com confirmação obrigatória, e bloqueio de itens já vencidos. | RE-03, RE-06, RE-07 |
| RF028 | Consultar Log de Auditoria e Histórico Operacional: histórico de entradas e estornos com filtro temporal (padrão ontem/hoje e intervalo customizado), busca, exportação em .xlsx, comprovante e estorno justificado. | RE-01, RE-03, RE-04, RE-08 |

### Requisitos não funcionais cobertos

| NF | Descrição canônica | Histórias associadas |
| --- | --- | --- |
| NF001 | Interface Intuitiva e Adaptada ao Contexto: fluxo direto de bancada com termos comuns da rotina (lote, validade, CAF, fabricante). | RE-05, RE-06, RE-07, RE-08 |
| NF002 | Design Responsivo: suporte para telas desktop e tablets. | RE-05, RE-06, RE-07, RE-08 |
| NF003 | Suporte ao Idioma Português (Brasil): datas em DD/MM/AAAA, números no formato nacional e mensagens em português. | Todas |
| NF005 | Persistência de Dados em Caso de Falha: salvamento automático da digitação para não perder itens em conferência. | RE-07 |
| NF007 | Tempo de Resposta da Interface: retorno de busca abaixo de 200ms e filtros de histórico em até 2 segundos. | RE-02, RE-04, RE-06, RE-08 |
| NF009 | Controle de Acesso Baseado em Perfil (RBAC): operações restritas a Farmacêutico Responsável, Farmacêutico Residente e Administrador. | Todas |
| NF015 | Isolamento de Dados por UBS (Multi-tenancy): separação estrita por unidade de saúde via Row-Level Security no PostgreSQL. | RE-01, RE-02, RE-03, RE-04 |

### Registros de arquitetura aplicados (ADRs)

| ADR | Tema | Histórias associadas |
| --- | --- | --- |
| ADR-002 / ADR-016 | Isolamento multi-tenant por UBS via RLS no PostgreSQL | RE-01, RE-02, RE-03, RE-04 |
| ADR-003 | Arquitetura Hexagonal no Backend | RE-02, RE-03, RE-04 |
| ADR-006 | Controle de acesso RBAC por perfil | Todas |
| ADR-007 | Rotas REST `/api/v1/*`, DTOs e documentação Swagger | RE-02, RE-03, RE-04 |
| ADR-008 / ADR-015 | Consistência transacional ACID com lock pessimista | RE-03, RE-04 |
| ADR-011 | Frontend React 19, Vite e Tailwind CSS | RE-05, RE-06, RE-07, RE-08 |
| ADR-013 | Gerenciamento de estado com Context API e TanStack Query | RE-05, RE-06, RE-07, RE-08 |
| ADR-022 | Contratos e DTOs compartilhados em `@farmaubs/shared` | Todas |
| ADR-030 | Pirâmide de testes BDD (Camadas A, B, C e D) | Todas |
| ADR-032 | Acessibilidade digital WCAG 2.1 AA | RE-05, RE-06, RE-07, RE-08 |

---

## Diretrizes de negócio e decisões operacionais

1. Identificação da entrada e do fornecedor:
   - Registro obrigatório do número do documento fiscal ou guia CAF (como `MOD 06 2908 2026` ou `GUIA-CAF-2026/089`).
   - Escolha da origem (CAF Central, Ministério da Saúde / DLOG, SESAPI, compra direta ou doação).
   - Data e hora da conferência na farmácia da UBS.

2. Busca em catálogo sem leitor óptico no MVP:
   - A seleção é feita por busca textual pelo nome comercial ou princípio ativo no catálogo oficial. O uso de leitor de código de barras fica para fases seguintes.

3. Fabricante, lote, validade e quantidade:
   - Cada item da entrada precisa informar o fabricante (laboratório), o código do lote impresso na embalagem, a data de validade e a quantidade recebida (número inteiro positivo).

4. Alerta de vencimento próximo e bloqueio de itens vencidos:
   - O sistema impede a entrada de lotes com validade igual ou anterior à data atual.
   - Para lotes com validade inferior a 6 meses (180 dias), o sistema exibe um aviso em tela e pede confirmação do farmacêutico antes de salvar.

5. Atualização atômica do estoque:
   - Ao confirmar a entrada, o sistema localiza o lote ou cria um novo registro na unidade, adiciona a quantidade ao saldo e registra o log de auditoria com usuário e horário.

6. Listagem inicial e filtros de período:
   - Por padrão, a tela de histórico abre filtrando apenas as entradas de ontem e hoje (`D-1` e `D0`).
   - O usuário pode alterar o intervalo de datas e buscar por texto (produto, lote, guia), fornecedor ou status da carga.

7. Exportação em XLSX:
   - O histórico pode ser baixado em formato `.xlsx` com base nos filtros e no período selecionado na tela.

8. Estorno com justificativa:
   - O estorno exige texto explicativo com pelo menos 10 caracteres e só é concluído se houver saldo suficiente no lote para a devolução.

9. Comprovante de recebimento:
   - O sistema gera o comprovante com os dados da UBS, do recebedor e a lista de produtos, com folha de estilo pronta para impressão pelo navegador (`@media print`).

---

## Backlog do épico

### Backend e fundação

| ID | Título | Testes | Depende de | Status |
| --- | --- | --- | --- | --- |
| [RE-01](./re-01-backend-migrations-schema-recebimento.md) | Migrações do schema de recebimento (`documentos_entrada`, `recebimento_itens`, `lotes`, `fabricantes` e movimentações) | B | DI-01 | ✅ Redigida |
| [RE-02](./re-02-backend-api-catalogo-busca-produtos-fabricantes.md) | API de Catálogo: busca de produtos, apresentações e cadastro de fabricantes | A, C | RE-01 | ✅ Redigida |
| [RE-03](./re-03-backend-api-efetivacao-transacao-entrada-estoque.md) | API de Efetivação: transação de entrada de estoque, atualização de lotes e log | A, B, C | RE-01, RE-02 | ✅ Redigida |
| [RE-04](./re-04-backend-api-historico-recebimentos-estorno.md) | API de Histórico: filtro ontem/hoje, intervalo customizado, comprovante, estorno e exportação em XLSX | A, C | RE-03 | ✅ Redigida |

### Frontend

| ID | Título | Testes | Depende de | Status |
| --- | --- | --- | --- | --- |
| [RE-05](./re-05-frontend-formulario-recebimento-cabecalho-guia.md) | Cabeçalho do recebimento: formulário de guia CAF/documento, origem e validações | D | RE-01 | ✅ Redigida |
| [RE-06](./re-06-frontend-busca-textual-medicamentos-fabricante-lote.md) | Busca de medicamentos, fabricante obrigatório, lote e avisos de validade | D | RE-02 | ✅ Redigida |
| [RE-07](./re-07-frontend-confirmacao-entrada-sincronizacao-estoque.md) | Efetivação da entrada: envio da carga, mensagens em tela e sincronização de saldo | D | RE-03, RE-05, RE-06 | ✅ Redigida |
| [RE-08](./re-08-frontend-tabela-ultimos-recebimentos-termo-estorno.md) | Painel de histórico: visualização ontem/hoje, intervalo customizado, XLSX, termo e estorno | D | RE-04, RE-07 | ✅ Redigida |

---

## Critérios de conclusão do épico (DoD)

- [x] 8 histórias redigidas com critérios de aceite em Gherkin em português.
- [ ] Schema de banco com migrações, chaves estrangeiras, índices e políticas de RLS por UBS.
- [ ] Preenchimento obrigatório de fabricante, lote, validade e quantidade nas entradas.
- [ ] Bloqueio de lotes vencidos e aviso para lotes com validade menor que 6 meses.
- [ ] Atualização de saldo em transação segura com registro de auditoria da entrada.
- [ ] Histórico com filtro padrão ontem/hoje, intervalo de datas e download de planilha XLSX.
- [ ] Comprovante de recebimento formatado para impressão no navegador.
- [ ] Estorno com justificativa textual e checagem de saldo disponível no lote.
- [ ] Testes automatizados cobrindo as camadas A, B, C e D.
