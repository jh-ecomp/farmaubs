# Mapa de Épicos e Histórias de Usuário (FarmaUBS)

Este documento serve como índice consolidado para acompanhar a especificação e implementação das histórias de usuário nos três pilares técnicos: **Backend**, **Frontend Web** (`apps/frontend`) e **Mobile** (`apps/mobile`), além do pacote compartilhado (`packages/shared`).

> ### 💡 Diretriz de Ciclos Independentes de Desenvolvimento (Web ↔ Mobile)
> O Frontend Web e o Aplicativo Mobile possuem **ciclos e esteiras de desenvolvimento independentes**.
> - Toda tipagem, DTO, enum ou função utilitária (ex.: validações matemáticas, cálculo FEFO, formatações) deve residir em `@farmaubs/shared`.
> - **Se a contra-parte já implementou a US correspondente**: reutilize diretamente os contratos e funções já exportados em `@farmaubs/shared`.
> - **Se a contra-parte ainda NÃO implementou a US correspondente**: a equipe que iniciar a história deve criar ou estender os contratos canônicos em `packages/shared/src/<modulo>/`, exportando-os em `packages/shared/src/index.ts` com testes unitários, permitindo o avanço autônomo sem acoplamento entre os aplicativos.

---

## Épico 1: Acesso e Autenticação do Sistema
| ID | Camada | Título | Redação (.md) | Implementação | Contra-parte |
| --- | --- | --- | --- | --- | --- |
| AC-01 a AC-15 | Backend | Migrations, RLS, Autenticação, RBAC, Sessão Server-side e Timeout | ✅ Redigidas | ✅ Concluída | — |
| AC-16 | Frontend | Tela de login com validação e feedback de erro (RF002) | ✅ Redigida | ✅ Concluída | AC-MOB-01 |
| AC-18 | Frontend | Gestão de usuários no painel administrativo (RF001, RF025) | ✅ Redigida | ✅ Concluída | — |
| AC-19 | Frontend | Contexto de autenticação: usuário atual, perfil e escopo (ADR-013) | ✅ Redigida | ✅ Concluída | AC-MOB-02 / AC-MOB-03 |
| AC-20 | Frontend | Aviso de timeout e renovação de sessão in-app (NF012) | ✅ Redigida | ✅ Concluída | AC-MOB-07 |
| AC-21 | Frontend | Proteção de rotas por perfil e logout (NF009) | ✅ Redigida | ✅ Concluída | AC-MOB-05 |
| AC-24 | Frontend | Tela de troca obrigatória de senha (RF002) | ✅ Redigida | ✅ Concluída | AC-MOB-04 |
| AC-25 | Frontend | Encerrar sessão no cliente e expurgo de cache | ✅ Redigida | ✅ Concluída | AC-MOB-05 |
| AC-30 | Frontend | Migração de sessão para cookie HttpOnly e expurgo localStorage | ✅ Redigida | ✅ Concluída | AC-MOB-02 |
| AC-MOB-01 | Mobile | Tela de Login Mobile com Validação, Feedback e Gestão de Teclado (RF002) | ✅ Redigida | ⏳ Não iniciada | AC-16 |
| AC-MOB-02 | Mobile | Armazenamento Seguro de Sessão em Keystore e permanência com app encerrado (NF011, ADR-034) | ✅ Redigida | ⏳ Não iniciada | AC-19 / AC-30 |
| AC-MOB-03 | Mobile | Seleção e alternância de UBS ativa em dispositivo móvel (NF015) | ✅ Redigida | ⏳ Não iniciada | AC-19 |
| AC-MOB-04 | Mobile | Fluxo de troca obrigatória de senha provisória no mobile (RF002) | ✅ Redigida | ⏳ Não iniciada | AC-24 |
| AC-MOB-05 | Mobile | Encerramento seguro de sessão (logout) no aplicativo móvel (RF004) | ✅ Redigida | ⏳ Não iniciada | AC-21 / AC-25 |
| AC-MOB-06 | Mobile | Detecção de conectividade e aviso de modo offline no mobile (ADR-014) | ✅ Redigida | ⏳ Não iniciada | PWA Offline |
| AC-MOB-07 | Mobile | Aviso de timeout de sessão via notificação nativa do SO Android (NF012, ADR-034) | ✅ Redigida | ⏳ Não iniciada | AC-20 |

---

## Épico 2: Dispensação de Medicamentos
| ID | Camada | Título | Redação (.md) | Implementação | Contra-parte |
| --- | --- | --- | --- | --- | --- |
| DI-01 | Backend | Migrações do schema de dispensação (`pacientes`, `dispensacoes`, etc.) | ✅ Redigida | ✅ Concluída | — |
| DI-02 | Backend | API de Pacientes: validação obrigatória (CNS, CPF, nome) e histórico | ✅ Redigida | ✅ Concluída | — |
| DI-03 | Backend | API de Dispensação: busca textual de medicamentos e algoritmo FEFO | ✅ Redigida | ✅ Concluída | — |
| DI-04 | Backend | API de Efetivação: baixa transacional de estoque e antimicrobianos | ✅ Redigida | ✅ Concluída | — |
| DI-05 | Backend | API de Histórico: filtro ontem/hoje, intervalo e exportação em XLSX | ✅ Redigida | ✅ Concluída | — |
| DI-06 | Frontend | Formulário de identificação do paciente (CNS, CPF) e histórico | ✅ Redigida | ⏳ Não iniciada | DI-MOB-01 |
| DI-07 | Frontend | Busca textual de medicamentos e seletor de lotes FEFO com alertas | ✅ Redigida | ⏳ Não iniciada | DI-MOB-02 |
| DI-08 | Frontend | Carrinho de dispensação: múltiplos itens, posologia e antimicrobianos | ✅ Redigida | ⏳ Não iniciada | DI-MOB-03 |
| DI-09 | Frontend | Tela principal integrando atendimento, métricas e baixa de estoque | ✅ Redigida | ⏳ Não iniciada | DI-MOB-04 |
| DI-10 | Frontend | Painel de histórico de dispensas com filtro ontem/hoje e XLSX | ✅ Redigida | ⏳ Não iniciada | DI-MOB-05 |
| DI-MOB-01 | Mobile | Identificação do paciente por Cartão SUS / CPF e consulta de histórico | ✅ Redigida | ⏳ Não iniciada | DI-06 |
| DI-MOB-02 | Mobile | Busca de medicamentos e seletor tátil de lotes FEFO com alertas | ✅ Redigida | ⏳ Não iniciada | DI-07 |
| DI-MOB-03 | Mobile | Carrinho de dispensação ágil e posologia por toque | ✅ Redigida | ⏳ Não iniciada | DI-08 |
| DI-MOB-04 | Mobile | Fechamento de dispensação com recibo digital e comprovante | ✅ Redigida | ⏳ Não iniciada | DI-09 |
| DI-MOB-05 | Mobile | Consulta rápida do histórico de dispensas no celular | ✅ Redigida | ⏳ Não iniciada | DI-10 |

---

## Épico 3: Recebimento de Medicamentos
| ID | Camada | Título | Redação (.md) | Implementação | Contra-parte |
| --- | --- | --- | --- | --- | --- |
| RE-01 | Backend | Migrações do schema de recebimento (`documentos_entrada`, `lotes`, etc.) | ✅ Redigida | ✅ Concluída | — |
| RE-02 | Backend | API de Catálogo: busca de produtos, apresentações e fabricantes | ✅ Redigida | ✅ Concluída | — |
| RE-03 | Backend | API de Efetivação: transação de entrada de estoque e atualização de lotes | ✅ Redigida | ✅ Concluída | — |
| RE-04 | Backend | API de Histórico: filtro ontem/hoje, comprovante, estorno e XLSX | ✅ Redigida | ✅ Concluída | — |
| RE-05 | Frontend | Cabeçalho do recebimento: formulário de guia CAF/documento e origem | ✅ Redigida | ⏳ Não iniciada | RE-MOB-01 |
| RE-06 | Frontend | Busca no catálogo, fabricante obrigatório, lote e avisos de validade | ✅ Redigida | ⏳ Não iniciada | RE-MOB-02 |
| RE-07 | Frontend | Efetivação da entrada: envio da carga e atualização de estoque | ✅ Redigida | ⏳ Não iniciada | RE-MOB-03 |
| RE-08 | Frontend | Painel de histórico: visualização ontem/hoje, XLSX, termo e estorno | ✅ Redigida | ⏳ Não iniciada | RE-MOB-04 |
| RE-MOB-01 | Mobile | Conferência rápida de guia de recebimento CAF na doca de entrega | ✅ Redigida | ⏳ Não iniciada | RE-05 |
| RE-MOB-02 | Mobile | Conferência física de lotes e aviso de validade no celular | ✅ Redigida | ⏳ Não iniciada | RE-06 |
| RE-MOB-03 | Mobile | Confirmação de entrada de estoque e recibo digital mobile | ✅ Redigida | ⏳ Não iniciada | RE-07 |
| RE-MOB-04 | Mobile | Histórico de conferências de recebimento e consulta de guias | ✅ Redigida | ⏳ Não iniciada | RE-08 |

---

## Épico 4: Controle de Estoque
| ID | Camada | Título | Redação (.md) | Implementação | Contra-parte |
| --- | --- | --- | --- | --- | --- |
| ES-01 | Backend | API Analítica: métricas globais, cálculo de ruptura e validade curta | ✅ Redigida | ⏳ Não iniciada | — |
| ES-02 | Backend | API de Saldos: consulta paginada com busca, categorias e lotes | ✅ Redigida | ⏳ Não iniciada | — |
| ES-03 | Backend | API de Ajustes: ajuste manual transacional com motivo e auditoria | ✅ Redigida | ⏳ Não iniciada | — |
| ES-04 | Backend | API de Rastreabilidade: linha do tempo de movimentações por lote | ✅ Redigida | ⏳ Não iniciada | — |
| ES-05 | Backend | API de Relatórios: geração de planilha XLSX por período e perdas | ✅ Redigida | ⏳ Não iniciada | — |
| ES-06 | Frontend | Painel superior: cartões com indicadores em tempo real (RF018, RF022) | ✅ Redigida | ⏳ Não iniciada | ES-MOB-01 |
| ES-07 | Frontend | Tabela de saldos por produto, expansão de lotes e destaque laranja | ✅ Redigida | ⏳ Não iniciada | ES-MOB-02 |
| ES-08 | Frontend | Barra de filtros avançados: busca, vencimento no mês e categorias | ✅ Redigida | ⏳ Não iniciada | ES-MOB-03 |
| ES-09 | Frontend | Modais de ficha de movimentação do lote e ajuste rápido justificado | ✅ Redigida | ⏳ Não iniciada | ES-MOB-04 / ES-MOB-05 |
| ES-10 | Frontend | Interface de relatórios com filtros por data e exportação em XLSX | ✅ Redigida | ⏳ Não iniciada | — |
| ES-MOB-01 | Mobile | Dashboard de saldos e indicadores de criticidade na palma da mão | ✅ Redigida | ⏳ Não iniciada | ES-06 |
| ES-MOB-02 | Mobile | Consulta rápida de saldos, lotes e validade no celular | ✅ Redigida | ⏳ Não iniciada | ES-07 |
| ES-MOB-03 | Mobile | Filtros rápidos de estoque (vencimento no mês, em falta) | ✅ Redigida | ⏳ Não iniciada | ES-08 |
| ES-MOB-04 | Mobile | Ajuste rápido e avulso de estoque com justificativa no dispositivo | ✅ Redigida | ⏳ Não iniciada | ES-09 |
| ES-MOB-05 | Mobile | Ficha de rastreabilidade do lote em dispositivo móvel | ✅ Redigida | ⏳ Não iniciada | ES-09 |

---

## Épico 5: Inventário Mensal
| ID | Camada | Título | Redação (.md) | Implementação | Contra-parte |
| --- | --- | --- | --- | --- | --- |
| IN-01 | Backend | Migrações do schema de inventário (`ciclos_inventario`, `atas`, etc.) | ✅ Redigida | ⏳ Não iniciada | — |
| IN-02 | Backend | API de Ciclos: início de ciclo, congelamento de saldo e rascunho | ✅ Redigida | ⏳ Não iniciada | — |
| IN-03 | Backend | API de Contagem: lançamento físico por lote e cálculo de divergências | ✅ Redigida | ⏳ Não iniciada | — |
| IN-04 | Backend | API de Homologação: acerto de saldos, Ata Oficial e XLSX | ✅ Redigida | ⏳ Não iniciada | — |
| IN-05 | Frontend | Tela de visão geral: histórico de ciclos, indicador ativo e início | ✅ Redigida | ⏳ Não iniciada | IN-MOB-01 |
| IN-06 | Frontend | Formulário de contagem física: digitação por lote e salvamento contínuo | ✅ Redigida | ⏳ Não iniciada | IN-MOB-02 |
| IN-07 | Frontend | Mapa de conciliação: comparação em tempo real e seletor de motivos | ✅ Redigida | ⏳ Não iniciada | IN-MOB-03 |
| IN-08 | Frontend | Modal de homologação: resumo das diferenças, impressão e XLSX | ✅ Redigida | ⏳ Não iniciada | IN-MOB-04 |
| IN-MOB-01 | Mobile | Visão geral dos ciclos de inventário e status no celular | ✅ Redigida | ⏳ Não iniciada | IN-05 |
| IN-MOB-02 | Mobile | Contagem física nas prateleiras com digitação ágil e salvamento local | ✅ Redigida | ⏳ Não iniciada | IN-06 |
| IN-MOB-03 | Mobile | Conferência rápida de divergências e justificativas no aparelho | ✅ Redigida | ⏳ Não iniciada | IN-07 |
| IN-MOB-04 | Mobile | Acompanhamento de homologação e protocolo digital de inventário | ✅ Redigida | ⏳ Não iniciada | IN-08 |
