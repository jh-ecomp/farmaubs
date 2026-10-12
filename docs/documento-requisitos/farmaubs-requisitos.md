# DOCUMENTO DE REQUISITOS

## Sistema de Gerenciamento de Estoque para Farmácias de UBS (FarmaUBS)

## Versão 1.0 · Junho de 2026 Parnaíba — PI


## Ficha Técnica

| Produto | FarmaUBS — Sistema de Gerenciamento de Estoque |
| --- | --- |
| Versão do Documento | 1.0 |
| Data | Junho de 2026 |
| Público-alvo | Farmacêuticos de Unidades Básicas de Saúde (UBS) — Parnaíba/PI |
| Classificação | Confidencial |


## 1. Descrição Geral do Sistema

O FarmaUBS é uma aplicação web voltada para profissionais farmacêuticos que atuam em Unidades Básicas de Saúde (UBS) municipais. O sistema tem como objetivo central prover controle de estoque de medicamentos com rastreabilidade por lote e validade, previsão de demanda e indicadores operacionais, eliminando a dependência de planilhas manuais e reduzindo o desperdício por vencimento de medicamentos. O produto é comercializado diretamente para farmacêuticos e coordenadores de farmácias de UBS, enquadrando-se como uma ferramenta SaaS (Software as a Service) para profissionais da saúde pública. Embora o contexto de uso seja o serviço público, a relação comercial é B2B com o profissional ou com a gestão da unidade de saúde.

## 1.1 Abrangência e Sistemas Relacionados

Principais funcionalidades contempladas pelo sistema:

- Cadastro e controle de estoque de medicamentos por apresentação, lote e validade.

- Registro de entradas (recebimento da CAF) e saídas (dispensas a pacientes).

- Geração de pedidos mensais com base em previsão de demanda e histórico de consumo.

- Dashboard de indicadores: estoque atual, consumo médio diário/mensal, tempo médio de permanência em prateleira, curva ABC.

- Alertas de medicamentos próximos ao vencimento e risco de ruptura de estoque.

- Histórico de dispensas por medicamento e paciente (opcional).

- Relatórios de inventário mensal para envio à gerentea da UBS e à CAF.

Escopo negativo — funcionalidades fora do escopo desta versão:

- Integração direta e bidirecional automática com o PEC (Prontuário Eletrônico do Cidadão); a integração é manual ou via exportação de dados.

- Controle de medicamentos de outras unidades (sem módulo centralizado multi-UBS nesta versão).

- Gestão financeira ou de compras pela CAF.

- Módulo de prescrição médica.

O sistema não é auto-contido e depende das seguintes integrações externas para pleno funcionamento:

- Serviço de e-mail transacional para envio de alertas e relatórios.

- Infraestrutura de nuvem (servidor web + banco de dados relacional) para hospedagem do sistema.

- Exportação de dados em formatos compatíveis (.xlsx, .csv, .pdf) para integração manual com planilhas e o PEC.

## 1.2 Descrição dos Usuários

O público-alvo primário são farmacêuticos residentes e formados que atuam nas farmácias de UBSs municipais, com rotina de trabalho que envolve controle manual de estoque, registro de dispensas e elaboração de pedidos mensais. Os usuários valorizam interfaces simples, rápidas e acessíveis em dispositivos comuns (computadores de mesa e notebooks institucionais, eventualmente smartphones).


I. Farmacêutico Responsável: Profissional responsável pela operação diária da farmácia. Registra entradas e saídas, consulta indicadores, gera pedidos e emite relatórios. Usuário principal do sistema. II. Farmacêutico Residente (R1/R2): Profissional em formação que executa as mesmas operações do farmacêutico responsável. Pode ter acesso a funcionalidades limitadas conforme configuração do gerente. III. Gerente/Coordenador da UBS: Profissional que consolida pedidos e os encaminha à CAF. Utiliza o sistema para visualizar relatórios e aprovar pedidos sem necessariamente operar o estoque. IV. Administrador do Sistema: Responsável pelo cadastro de usuários, configuração de UBSs e manutenção do ambiente. Perfil técnico, geralmente externo à UBS.


## 2. Requisitos Funcionais

## 2.1 Gerenciar Acesso ao Sistema

| [RF001] CADASTRO DE USUÁRIO |   |
| --- | --- |
| Descrição | O sistema deve permitir o cadastro de novos usuários, associando cada usuário a uma |
|   | ou mais UBSs e a um perfil de acesso (Farmacêutico, Gerente, Administrador). |
| Ator(es) | Administrador do Sistema |
| Prioridade | Essencial Importante Desejável |
| Entradas / | Nome completo, e-mail institucional, senha, perfil de acesso, UBS(s) associada(s). O |
| Pré-condições | usuário deve estar autenticado como Administrador. |
| Saídas / | Sucesso: novo usuário cadastrado e e-mail de confirmação enviado. Falha: mensagem |
| Pós-condições | de erro detalhada (e-mail já cadastrado, campos inválidos etc.). |

| [RF002] LOGIN |   |
| --- | --- |
| Descrição | O sistema deve permitir o acesso de usuários cadastrados mediante e-mail e senha. |
| Ator(es) | Usuário (qualquer perfil), Sistema de autenticação |
| Prioridade | Essencial Importante Desejável |
| Entradas / | E-mail e senha. O sistema deve estar na tela de login. |
| Pré-condições |   |
| Saídas / | Sucesso: sessão iniciada; usuário redirecionado ao dashboard da sua UBS padrão. |
| Pós-condições | Falha: mensagem de credenciais inválidas; após 5 tentativas, a conta fica bloqueada |
|   | temporariamente por 15 minutos. |

| [RF003] RECUPERAÇÃO DE SENHA |   |
| --- | --- |
| Descrição | O sistema deve permitir que o usuário recupere o acesso à sua conta por meio de |
|   | e-mail de redefinição de senha. |
| Ator(es) | Usuário, Sistema de e-mail |
| Prioridade | Essencial Importante Desejável |
| Entradas / | E-mail cadastrado. O sistema deve estar na tela de login. |
| Pré-condições |   |
| Saídas / | E-mail com link de redefinição válido por 2 horas enviado ao endereço informado. |
| Pós-condições | Falha: e-mail não encontrado — mensagem genérica para não expor cadastros. |


| [RF004] LOGOUT |   |
| --- | --- |
| Descrição | O sistema deve encerrar a sessão do usuário autenticado. |
| Ator(es) | Usuário (qualquer perfil) |
| Prioridade | Essencial Importante Desejável |
| Entradas / | Usuário deve estar autenticado. |
| Pré-condições |   |
| Saídas / | Sessão encerrada; usuário redirecionado à tela de login. |
| Pós-condições |   |

## 2.2 Gerenciar Cadastro de Medicamentos

| [RF005] CADASTRAR MEDICAMENTO |   |
| --- | --- |
| Descrição | O sistema deve permitir o cadastro de medicamentos com suas apresentações |
|   | (comprimido, solução injetável, xarope etc.), concentração, unidade de medida e código |
|   | de referência (código RENAME/REMUME quando aplicável). |
| Ator(es) | Farmacêutico, Administrador |
| Prioridade | Essencial Importante Desejável |
| Entradas / | Nome do princípio ativo, nome comercial (opcional), forma farmacêutica, |
| Pré-condições | concentração, unidade de medida, código de referência. Usuário deve estar |
|   | autenticado. |
| Saídas / | Sucesso: medicamento cadastrado no catálogo da UBS. Falha: mensagem de erro |
| Pós-condições | (medicamento duplicado, campos obrigatórios ausentes). |

| [RF006] EDITAR MEDICAMENTO |   |
| --- | --- |
| Descrição | O sistema deve permitir a edição das informações de um medicamento cadastrado. |
| Ator(es) | Farmacêutico, Administrador |
| Prioridade | Essencial Importante Desejável |
| Entradas / | Medicamento selecionado; dados a alterar. Usuário autenticado. |
| Pré-condições |   |
| Saídas / | Sucesso: dados atualizados com registro de log da alteração. Falha: mensagem de erro. |
| Pós-condições |   |

| [RF007] INATIVAR/REATIVAR MEDICAMENTO |   |
| --- | --- |
| Descrição | O sistema deve permitir inativar um medicamento do catálogo (sem excluí-lo, |
|   | preservando o histórico) ou reativá-lo. |


| Ator(es) |   | Farmacêutico, Administrador |   |
| --- | --- | --- | --- |
| Prioridade | Essencial | Importante | Desejável |
| Entradas / | Medicamento selecionado. Usuário autenticado. |   |   |
| Pré-condições |   |   |   |
| Saídas / | Medicamento inativado ou reativado; histórico de movimentação preservado. |   |   |
| Pós-condições |   |   |   |

## 2.3 Gerenciar Estoque — Entradas

| [RF008] REGISTRAR RECEBIMENTO DE MEDICAMENTOS |   |
| --- | --- |
| Descrição | O sistema deve permitir o registro do recebimento de medicamentos enviados pela |
|   | CAF, incluindo número de lote, data de validade e quantidade recebida de cada item. |
| Ator(es) | Farmacêutico |
| Prioridade | Essencial Importante Desejável |
| Entradas / | Medicamento, lote, data de validade, quantidade recebida, data de recebimento. |
| Pré-condições | Usuário autenticado. |
| Saídas / | Estoque atualizado; entrada registrada no histórico com data, usuário responsável, lote |
| Pós-condições | e validade. Alerta gerado se a validade recebida for inferior a 6 meses. |

| [RF009] REGISTRAR AJUSTE DE ESTOQUE (ENTRADA) |   |
| --- | --- |
| Descrição | O sistema deve permitir o registro de ajustes positivos no estoque (ex.: correção de |
|   | inventário, devolução de medicamento de paciente) com justificativa obrigatória. |
| Ator(es) | Farmacêutico |
| Prioridade | Essencial Importante Desejável |
| Entradas / | Medicamento, lote, quantidade, motivo do ajuste. Usuário autenticado. |
| Pré-condições |   |
| Saídas / | Estoque atualizado; ajuste registrado no log de auditoria com motivo e responsável. |
| Pós-condições |   |

## 2.4 Gerenciar Estoque — Saídas (Dispensas)

| [RF010] REGISTRAR DISPENSA DE MEDICAMENTO |   |
| --- | --- |
| Descrição | O sistema deve permitir o registro da dispensa de medicamentos a pacientes, |
|   | especificando o medicamento, apresentação, lote, quantidade dispensada e, |


|   | opcionalmente, o identificador do paciente (CNS ou CPF) para controle de uso |
| --- | --- |
|   | contínuo. |
| Ator(es) | Farmacêutico |
| Prioridade | Essencial Importante Desejável |
| Entradas / | Medicamento, lote (sugerido pelo sistema seguindo FEFO — First Expired, First Out), |
| Pré-condições | quantidade, data, identificador do paciente (opcional). Usuário autenticado. |
| Saídas / | Estoque decrementado; dispensa registrada no histórico. O sistema sugere |
| Pós-condições | automaticamente o lote de validade mais próxima (FEFO). |

| [RF011] REGISTRAR AJUSTE DE ESTOQUE (SAÍDA) |   |
| --- | --- |
| Descrição | O sistema deve permitir o registro de ajustes negativos no estoque (ex.: descarte por |
|   | vencimento, perda, avaria) com justificativa e tipo de motivo obrigatórios. |
| Ator(es) | Farmacêutico |
| Prioridade | Essencial Importante Desejável |
| Entradas / | Medicamento, lote, quantidade, motivo (vencimento, avaria, extravio). Usuário |
| Pré-condições | autenticado. |
| Saídas / | Estoque decrementado; descarte registrado no log de auditoria; relatório de perdas |
| Pós-condições | atualizado. |

| [RF012] CONSULTAR HISTÓRICO DE DISPENSAS |   |
| --- | --- |
| Descrição | O sistema deve exibir o histórico de dispensas filtrado por medicamento, período, lote |
|   | ou paciente (quando identificado). |
| Ator(es) | Farmacêutico, Gerente |
| Prioridade | Essencial Importante Desejável |
| Entradas / | Filtros de busca (medicamento, período, lote, paciente). Usuário autenticado. |
| Pré-condições |   |
| Saídas / | Lista paginada de dispensas correspondentes aos filtros aplicados. |
| Pós-condições |   |

## 2.5 Inventário

| [RF013] REALIZAR INVENTÁRIO MENSAL |   |
| --- | --- |
| Descrição | O sistema deve guiar o farmacêutico no processo de inventário mensal, exibindo os |
|   | medicamentos cadastrados para conferência e permitindo o lançamento das |
|   | quantidades físicas contadas, gerando automaticamente o relatório de diferenças |
|   | (sobras e faltas). |


| Ator(es) | Farmacêutico |   |   |
| --- | --- | --- | --- |
| Prioridade | Essencial | Importante | Desejável |
| Entradas / | Quantidades físicas contadas para cada medicamento/lote. Usuário autenticado. Data |   |   |
| Pré-condições | do inventário. |   |   |
| Saídas / | Relatório de inventário gerado com divergências destacadas; estoque ajustado |   |   |
| Pós-condições |   |   | conforme confirmação do farmacêutico; histórico de inventário salvo. |

| [RF014] CONSULTAR HISTÓRICO DE INVENTÁRIOS |   |
| --- | --- |
| Descrição | O sistema deve exibir o histórico de inventários mensais realizados, com comparativo |
|   | entre estoque teórico e físico. |
| Ator(es) | Farmacêutico, Gerente |
| Prioridade | Essencial Importante Desejável |
| Entradas / | Filtro de período. Usuário autenticado. |
| Pré-condições |   |
| Saídas / | Lista de inventários com data, responsável e sumário de divergências. |
| Pós-condições |   |

## 2.6 Previsão de Demanda e Pedidos

| [RF015] CONSULTAR SUGESTÃO DE PEDIDO MENSAL |   |
| --- | --- |
| Descrição | O sistema deve calcular e exibir a sugestão de quantidade a pedir de cada |
|   | medicamento com base no consumo médio histórico (mínimo 3 meses, |
|   | preferencialmente 12 meses para capturar sazonalidade), no estoque atual e no tempo |
|   | médio de entrega da CAF (10–15 dias), aplicando ponto de pedido e estoque de |
|   | segurança. |
| Ator(es) | Farmacêutico |
| Prioridade | Essencial Importante Desejável |
| Entradas / | Histórico de consumo disponível no sistema. Usuário autenticado. |
| Pré-condições |   |
| Saídas / | Lista de medicamentos com quantidade sugerida, estoque atual, consumo médio |
| Pós-condições | mensal, cobertura estimada e indicação de risco de ruptura. |

| [RF016] GERAR E EDITAR PEDIDO DE MEDICAMENTOS |   |
| --- | --- |
| Descrição | O sistema deve permitir que o farmacêutico gere um pedido mensal a partir da |
|   | sugestão automática ou do zero, com possibilidade de editar quantidades antes de |
|   | finalizar. |


| Ator(es) | Farmacêutico |   |   |
| --- | --- | --- | --- |
| Prioridade | Essencial | Importante | Desejável |
| Entradas / | Quantidades confirmadas ou ajustadas para cada medicamento. Usuário autenticado. |   |   |
| Pré-condições |   |   |   |
| Saídas / | Pedido salvo com data, responsável e status (Rascunho ou Enviado para Gerente). |   |   |
| Pós-condições |   |   |   |

| [RF017] EXPORTAR PEDIDO PARA PLANILHA |   |
| --- | --- |
| Descrição | O sistema deve exportar o pedido de medicamentos no formato .xlsx compatível com o |
|   | modelo utilizado pela gerentea da UBS para envio à CAF. |
| Ator(es) | Farmacêutico |
| Prioridade | Essencial Importante Desejável |
| Entradas / | Pedido finalizado. Usuário autenticado. |
| Pré-condições |   |
| Saídas / | Arquivo .xlsx gerado e disponibilizado para download. |
| Pós-condições |   |

## 2.7 Indicadores e Relatórios

| [RF018] EXIBIR DASHBOARD DE INDICADORES |   |
| --- | --- |
| Descrição | O sistema deve exibir um painel com os principais indicadores operacionais da |
|   | farmácia: consumo médio diário e mensal por medicamento, tempo médio de |
|   | permanência em prateleira, curva ABC de medicamentos, total de perdas por |
|   | vencimento no período e cobertura de estoque em dias. |
| Ator(es) | Farmacêutico, Gerente |
| Prioridade | Essencial Importante Desejável |
| Entradas / | Dados de estoque e dispensas cadastrados no sistema. Usuário autenticado. |
| Pré-condições |   |
| Saídas / | Dashboard atualizado em tempo real com gráficos e tabelas interativas. |
| Pós-condições |   |

| [RF019] EXIBIR CURVA ABC DE MEDICAMENTOS |   |
| --- | --- |
| Descrição | O sistema deve classificar os medicamentos em curvas A (alto giro), B (médio giro) e C |
|   | (baixo giro) com base no volume de dispensas no período selecionado, auxiliando no |
|   | planejamento prioritário de estoque. |
| Ator(es) | Farmacêutico |


| Prioridade | Essencial | Importante | Desejável |
| --- | --- | --- | --- |
| Entradas / |   |   | Período de análise selecionado. Histórico de dispensas cadastrado. Usuário |
| Pré-condições | autenticado. |   |   |
| Saídas / |   |   | Tabela e gráfico de distribuição ABC com destaque visual por categoria. |
| Pós-condições |   |   |   |

| [RF020] GERAR RELATÓRIO DE PERDAS POR VENCIMENTO |   |
| --- | --- |
| Descrição | O sistema deve gerar relatório consolidado de medicamentos descartados por |
|   | vencimento no período selecionado, com detalhamento por medicamento, lote, |
|   | quantidade e data de descarte. |
| Ator(es) | Farmacêutico, Gerente |
| Prioridade | Essencial Importante Desejável |
| Entradas / | Período de análise. Registros de descarte por vencimento. Usuário autenticado. |
| Pré-condições |   |
| Saídas / | Relatório exportável em .pdf e .xlsx com totais e detalhamento. |
| Pós-condições |   |

| [RF021] GERAR RELATÓRIO DE INVENTÁRIO MENSAL |   |
| --- | --- |
| Descrição | O sistema deve gerar o relatório formal de inventário mensal no formato exigido para |
|   | envio à gerentea da UBS, contendo quantidade anterior, entradas, saídas, saldo atual, |
|   | lotes e validades. |
| Ator(es) | Farmacêutico |
| Prioridade | Essencial Importante Desejável |
| Entradas / | Inventário mensal concluído. Usuário autenticado. |
| Pré-condições |   |
| Saídas / | Relatório em .pdf e .xlsx disponível para download e envio. |
| Pós-condições |   |

## 2.8 Alertas e Notificações

| [RF022] ALERTAR MEDICAMENTOS PRÓXIMOS AO VENCIMENTO |   |
| --- | --- |
| Descrição | O sistema deve gerar alertas visuais (no dashboard) e por e-mail para medicamentos |
|   | com validade igual ou inferior ao limite configurado (padrão: 90 dias), destacando lote, |
|   | quantidade e data de vencimento. |
| Ator(es) | Sistema, Farmacêutico |
| Prioridade | Essencial Importante Desejável |


| Entradas / | Validade dos lotes cadastrados no estoque. Limiar de alerta configurado. |
| --- | --- |
| Pré-condições |   |
| Saídas / | Alerta exibido no dashboard e e-mail enviado ao farmacêutico responsável. |
| Pós-condições |   |

| [RF023] ALERTAR RISCO DE RUPTURA DE ESTOQUE |   |
| --- | --- |
| Descrição | O sistema deve identificar e alertar medicamentos cuja cobertura de estoque (dias |
|   | restantes com base no consumo médio) seja inferior ao tempo médio de entrega da |
|   | CAF mais uma margem de segurança configurável. |
| Ator(es) | Sistema, Farmacêutico |
| Prioridade | Essencial Importante Desejável |
| Entradas / | Estoque atual, consumo médio, tempo de entrega configurado. |
| Pré-condições |   |
| Saídas / | Alerta visual no dashboard com lista de medicamentos em risco de ruptura e cobertura |
| Pós-condições | estimada em dias. |

| [RF024] ALERTAR RECEBIMENTO DE MEDICAMENTOS COM VALIDADE CURTA |   |
| --- | --- |
| Descrição | Ao registrar uma entrada, o sistema deve alertar quando a validade do lote recebido |
|   | for inferior a 6 meses, exigindo confirmação do farmacêutico antes de prosseguir. |
| Ator(es) | Sistema, Farmacêutico |
| Prioridade | Essencial Importante Desejável |
| Entradas / | Data de validade do lote recebido. |
| Pré-condições |   |
| Saídas / | Diálogo de confirmação exibido; entrada registrada somente após confirmação |
| Pós-condições | explícita. |

## 2.9 Administração do Sistema

| [RF025] GERENCIAR USUÁRIOS |   |
| --- | --- |
| Descrição | O sistema deve permitir ao Administrador criar, editar, inativar e reativar usuários, |
|   | bem como alterar seus perfis e UBSs associadas. |
| Ator(es) | Administrador |
| Prioridade | Essencial Importante Desejável |
| Entradas / | Dados do usuário. Administrador autenticado. |
| Pré-condições |   |


| Saídas / | Usuário criado, editado ou inativado; log de auditoria atualizado. |
| --- | --- |
| Pós-condições |   |

| [RF026] GERENCIAR UBSS |   |
| --- | --- |
| Descrição | O sistema deve permitir ao Administrador cadastrar e editar Unidades Básicas de |
|   | Saúde, incluindo nome, endereço, responsável técnico e tempo médio de entrega da |
|   | CAF. |
| Ator(es) | Administrador |
| Prioridade | Essencial Importante Desejável |
| Entradas / | Dados da UBS. Administrador autenticado. |
| Pré-condições |   |
| Saídas / | UBS cadastrada ou atualizada no sistema. |
| Pós-condições |   |

| [RF027] CONFIGURAR PARÂMETROS DO SISTEMA |   |
| --- | --- |
| Descrição | O sistema deve permitir ao Administrador ou ao Farmacêutico Responsável configurar |
|   | parâmetros operacionais por UBS: limiar de alerta de vencimento (em dias), estoque de |
|   | segurança (em dias de cobertura), tempo médio de entrega da CAF. |
| Ator(es) | Administrador, Farmacêutico Responsável |
| Prioridade | Essencial Importante Desejável |
| Entradas / | Parâmetros a configurar. Usuário com perfil adequado. |
| Pré-condições |   |
| Saídas / | Parâmetros salvos; cálculos automáticos do sistema atualizados imediatamente. |
| Pós-condições |   |

| [RF028] CONSULTAR LOG DE AUDITORIA |   |
| --- | --- |
| Descrição | O sistema deve registrar e exibir, de forma somente leitura, todas as operações |
|   | realizadas (entradas, saídas, ajustes, alterações cadastrais), com data, hora, usuário e |
|   | detalhes da operação. |
| Ator(es) | Administrador, Gerente |
| Prioridade | Essencial Importante Desejável |
| Entradas / | Filtros de período, usuário e tipo de operação. Usuário com perfil adequado. |
| Pré-condições |   |
| Saídas / | Lista paginada de eventos de auditoria; exportação em .xlsx disponível. |
| Pós-condições |   |


## 3. Requisitos Não Funcionais

## 3.1 Usabilidade

| [NF001] INTERFACE INTUITIVA E ADAPTADA AO CONTEXTO |   |
| --- | --- |
| Descrição | A interface deve ser simples, objetiva e orientada a fluxos de trabalho reais da farmácia |
|   | (registro de entrada, dispensa, pedido). Nomenclaturas devem seguir o vocabulário já |
|   | utilizado pelos farmacêuticos (ex.: 'dispensa', 'pedido mensal', 'lote', 'CAF'). Fluxos críticos |
|   | não devem exigir mais de 3 cliques a partir da tela inicial. |
| Prioridade | Essencial Importante Desejável |
| Caso(s) de uso associado(s) | Registro de entrada, dispensa, geração de pedidos, consulta de dashboard. |

| [NF002] DESIGN RESPONSIVO |   |   |   |
| --- | --- | --- | --- |
| Descrição | A interface deve ser funcional em resoluções de desktop (1280×720 ou superior) e em tablets (768px de largura mínima), dado que os farmacêuticos podem utilizar dispositivos variados no ambiente de trabalho. |   |   |
| Prioridade | Essencial | Importante | Desejável |
| Caso(s) de uso associado(s) |   | Todos os módulos do sistema. |   |

| [NF003] SUPORTE AO IDIOMA PORTUGUÊS (BRASIL) |   |   |   |
| --- | --- | --- | --- |
| Descrição | Toda a interface, mensagens de erro, alertas e relatórios devem estar em Português do Brasil. Formatos de data (DD/MM/AAAA) e números (separador decimal vírgula) devem seguir o padrão nacional. |   |   |
| Prioridade | Essencial | Importante | Desejável |
| Caso(s) de uso associado(s) | Todos os módulos. |   |   |

## 3.2 Confiabilidade

| [NF004] DISPONIBILIDADE MÍNIMA |   |
| --- | --- |
| Descrição | O sistema deve manter disponibilidade de 99,5% mensais (downtime máximo de ~3,6 horas/mês), excluindo janelas de manutenção programada comunicadas com antecedência mínima de 48 horas. |


| Prioridade | Essencial | Importante | Desejável |
| --- | --- | --- | --- |
| Caso(s) de | Todos os módulos. |   |   |
| uso |   |   |   |
| associado(s) |   |   |   |

| [NF005] PERSISTÊNCIA DE DADOS EM CASO DE FALHA |   |
| --- | --- |
| Descrição | Registros de entrada e dispensa em curso não devem ser perdidos em caso de queda de |
|   | conexão. O sistema deve salvar rascunhos automaticamente a cada 30 segundos e |
|   | alertar o usuário sobre o estado da conexão. |
| Prioridade | Essencial Importante Desejável |
| Caso(s) de | RF008 — Registrar Recebimento; RF010 — Registrar Dispensa. |
| uso |   |
| associado(s) |   |

| [NF006] BACKUP AUTOMÁTICO DE DADOS |   |
| --- | --- |
| Descrição | O banco de dados deve ser submetido a backup completo diário e incremental a cada 4 |
|   | horas, com retenção mínima de 30 dias. Restauração deve ser possível em até 4 horas. |
| Prioridade | Essencial Importante Desejável |
| Caso(s) de | Toda a base de dados do sistema. |
| uso |   |
| associado(s) |   |

## 3.3 Desempenho

| [NF007] TEMPO DE RESPOSTA DA INTERFACE |   |
| --- | --- |
| Descrição | O carregamento inicial do dashboard e de qualquer tela principal deve ocorrer em até 3 |
|   | segundos em conexões de 10 Mbps. Consultas e filtros devem retornar resultados em |
|   | até 2 segundos para bases de até 12 meses de histórico. |
| Prioridade | Essencial Importante Desejável |
| Caso(s) de | RF018 — Dashboard; RF012 — Histórico de Dispensas; RF019 — Curva ABC. |
| uso |   |
| associado(s) |   |

| [NF008] GERAÇÃO DE RELATÓRIOS |   |
| --- | --- |
| Descrição | Relatórios de inventário mensal e de perdas devem ser gerados e disponibilizados para |
|   | download em até 30 segundos para qualquer período de até 24 meses. |
| Prioridade | Essencial Importante Desejável |


| Caso(s) de uso associado(s) | RF020, RF021. |
| --- | --- |

## 3.4 Segurança

| [NF009] CONTROLE DE ACESSO BASEADO EM PERFIL (RBAC) |   |
| --- | --- |
| Descrição | O sistema deve restringir o acesso a funcionalidades com base no perfil do usuário |
|   | (Farmacêutico, Gerente, Administrador). Farmacêuticos não devem ter acesso ao log de |
|   | auditoria completo nem ao módulo de gerenciamento de usuários. |
| Prioridade | Essencial Importante Desejável |
| Caso(s) de | Todos os módulos. |
| uso |   |
| associado(s) |   |

| [NF010] PROTEÇÃO DE DADOS PESSOAIS (LGPD) |   |
| --- | --- |
| Descrição | Dados de identificação de pacientes (CNS, CPF), quando coletados, devem ser |
|   | armazenados com criptografia em repouso (AES-256) e transmitidos via HTTPS/TLS 1.2 |
|   | ou superior. O sistema deve estar em conformidade com a Lei Geral de Proteção de |
|   | Dados (Lei nº 13.709/2018). |
| Prioridade | Essencial Importante Desejável |
| Caso(s) de | RF010 — Registrar Dispensa (campo paciente); RF028 — Log de Auditoria. |
| uso |   |
| associado(s) |   |

| [NF011] AUTENTICAÇÃO SEGURA |   |
| --- | --- |
| Descrição | Senhas devem ser armazenadas com hash bcrypt (fator de custo mínimo 12). O sistema |
|   | deve suportar autenticação em dois fatores (2FA) via TOTP (Google Authenticator, |
|   | Authy) como opção para todos os perfis. |
| Prioridade | Essencial Importante Desejável |
| Caso(s) de | RF001 — Cadastro; RF002 — Login. |
| uso |   |
| associado(s) |   |

| [NF012] TIMEOUT DE SESSÃO |   |
| --- | --- |
| Descrição | Sessões inativas por mais de 60 minutos devem ser encerradas automaticamente, |
|   | exigindo novo login. O usuário deve ser alertado 5 minutos antes do encerramento da |
|   | sessão. |


| Prioridade | Essencial | Importante | Desejável |
| --- | --- | --- | --- |
| Caso(s) de | RF002 — Login; RF004 — Logout. |   |   |
| uso |   |   |   |
| associado(s) |   |   |   |

## 3.5 Distribuição e Implantação

| [NF013] ACESSO VIA NAVEGADOR WEB |   |
| --- | --- |
| Descrição | O sistema deve funcionar nos navegadores Google Chrome (versão 100+), Mozilla |
|   | Firefox (versão 100+) e Microsoft Edge (versão 100+), sem necessidade de instalação de |
|   | plugins ou extensões. |
| Prioridade | Essencial Importante Desejável |
| Caso(s) de | Todos os módulos. |
| uso |   |
| associado(s) |   |

| [NF014] HOSPEDAGEM EM NUVEM COM ESCALABILIDADE |   |
| --- | --- |
| Descrição | A infraestrutura deve suportar pelo menos 50 usuários simultâneos sem degradação de |
|   | desempenho, com capacidade de escalonamento horizontal para acomodar o |
|   | crescimento da base de clientes. |
| Prioridade | Essencial Importante Desejável |
| Caso(s) de | Todos os módulos. |
| uso |   |
| associado(s) |   |

| [NF015] ISOLAMENTO DE DADOS POR UBS (MULTI-TENANCY) |   |
| --- | --- |
| Descrição | Dados de medicamentos, dispensas e estoques de cada UBS devem ser isolados |
|   | logicamente, garantindo que usuários de uma UBS não acessem dados de outra, exceto |
|   | quando explicitamente autorizado pelo Administrador. |
| Prioridade | Essencial Importante Desejável |
| Caso(s) de | Todos os módulos de estoque e relatórios. |
| uso |   |
| associado(s) |   |


## 3.6 Padrões e Conformidade

| [NF016] CONFORMIDADE COM A RENAME E REMUME |   |
| --- | --- |
| Descrição | O sistema deve suportar a catalogação de medicamentos seguindo a nomenclatura e |
|   | classificação da RENAME (Relação Nacional de Medicamentos Essenciais) e permitir a |
|   | personalização para a REMUME (Relação Municipal de Medicamentos Essenciais) de |
|   | cada município. |
| Prioridade | Essencial Importante Desejável |
| Caso(s) de | RF005 — Cadastrar Medicamento. |
| uso |   |
| associado(s) |   |

| [NF017] RASTREABILIDADE PELO PRINCÍPIO FEFO |   |
| --- | --- |
| Descrição | O sistema deve aplicar obrigatoriamente o princípio FEFO (First Expired, First Out) na |
|   | sugestão de lotes para dispensa, garantindo que medicamentos com validade mais |
|   | próxima sejam sugeridos primeiramente para consumo. |
| Prioridade | Essencial Importante Desejável |
| Caso(s) de | RF010 — Registrar Dispensa. |
| uso |   |
| associado(s) |   |

| [NF018] AUDITABILIDADE E RASTREABILIDADE DE OPERAÇÕES |   |
| --- | --- |
| Descrição | Toda operação que altere o estado do estoque (entrada, saída, ajuste, descarte) deve ser |
|   | registrada com timestamp, usuário responsável e estado anterior e posterior, sendo |
|   | imutável após o registro. Somente o log de auditoria pode ser consultado, não editado. |
| Prioridade | Essencial Importante Desejável |
| Caso(s) de | RF008, RF009, RF010, RF011, RF028. |
| uso |   |
| associado(s) |   |

| [NF019] EXPORTAÇÃO ABERTA DE DADOS |   |
| --- | --- |
| Descrição | O sistema deve permitir a exportação de todos os dados do usuário nos formatos .xlsx e |
|   | .csv a qualquer momento, sem custo adicional, garantindo a portabilidade e evitando |
|   | aprisionamento tecnológico (vendor lock-in). |
| Prioridade | Essencial Importante Desejável |
| Caso(s) de | RF017, RF020, RF021, RF028. |
| uso |   |
| associado(s) |   |


## 3.7 Hardware e Software

| [NF020] REQUISITOS MÍNIMOS DO CLIENTE |   |
| --- | --- |
| Descrição | O sistema deve ser utilizável em computadores com processador dual-core 1,8 GHz, 4 |
|   | GB de RAM, navegador atualizado e conexão de internet de no mínimo 2 Mbps. Não |
|   | deve exigir hardware dedicado ou licenças de software proprietário. |
| Prioridade | Essencial Importante Desejável |
| Caso(s) de | Todos os módulos. |
| uso |   |
| associado(s) |   |

| [NF021] REQUISITOS DO SERVIDOR |   |
| --- | --- |
| Descrição | O servidor de aplicação deve suportar balanceamento de carga, banco de dados |
|   | relacional com suporte a transações ACID (PostgreSQL ou equivalente) e ambiente |
|   | containerizado (Docker/Kubernetes) para facilitar implantação e manutenção. |
| Prioridade | Essencial Importante Desejável |
| Caso(s) de uso associado(s) | Infraestrutura de todo o sistema. |

— Fim do Documento —
