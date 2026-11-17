# Diagramas UML: Casos de Uso, Classes de Domínio e Ciclo de Estados (FarmaUBS)

Este documento consolida a modelagem conceitual UML do FarmaUBS atualizada para contemplar o **Incremento 1** (Acesso, Recebimento, Dispensação, Controle de Estoque e Inventário Mensal) e o **Novo Incremento 2 — Épico 6: Alertas, Notificações e Parâmetros Operacionais** (`RF022`, `RF023`, `RF024`, `RF026`, `RF027`, `RF028`).

---

## 1. Diagrama de Casos de Uso por Perfil de Acesso (RBAC)

O diagrama abaixo mapeia os quatro perfis canônicos do sistema (`FARMACEUTICO_RESPONSAVEL`, `FARMACEUTICO_RESIDENTE`, `GERENTE` e `ADMINISTRADOR`) e o ator sistêmico (`Worker Outbox / Job Diário`) frente aos casos de uso operacionais e de monitoramento ativo.

```mermaid
flowchart LR
    subgraph Atores["Atores do Sistema"]
        FR["Farmacêutico Responsável\n(RT da UBS)"]
        FRes["Farmacêutico Residente\n(Operação da UBS)"]
        Ger["Gerente / Coordenador\n(Gestão Municipal / UBS)"]
        Adm["Administrador do Sistema\n(Governança e TI)"]
        Sys["Motor de Alertas & Outbox\n(Ator Sistêmico)"]
    end

    subgraph ModuloOperacional["Incremento 1: Núcleo Operacional (Épicos 1 a 5)"]
        UC01["UC01: Autenticar e Selecionar UBS Ativa (RF002, NF015)"]
        UC02["UC02: Registrar Recebimento de Guia CAF (RF008)"]
        UC03["UC03: Registrar Dispensação com Sugestão FEFO (RF010)"]
        UC04["UC04: Consultar Saldos e Lotes de Estoque (RF018)"]
        UC05["UC05: Realizar Ajuste Manual Justificado (RF009, RF011)"]
        UC06["UC06: Executar e Homologar Inventário Mensal (RF013, RF014)"]
        UC07["UC07: Exportar Relatórios e Atas em XLSX (RF020, RF021)"]
    end

    subgraph ModuloAlertas["Novo Incremento 2: Alertas e Parâmetros (Épico 6)"]
        UC08["UC08: Consultar Central de Alertas de Vencimento e Ruptura (RF022, RF023)"]
        UC09["UC09: Confirmar Leitura de Alertas no Web e Mobile (RF022, RF023)"]
        UC10["UC10: Confirmar Recebimento de Lote com Validade < 6 Meses (RF024)"]
        UC11["UC11: Configurar Parâmetros Operacionais da UBS (RF026, RF027)"]
        UC12["UC12: Avaliar Cobertura e Vencimentos Automaticamente (RF022, RF023)"]
        UC13["UC13: Enviar Notificações por E-mail e Push Local (RF022, RF023, ADR-004)"]
    end

    subgraph ModuloAdmin["Governança e Auditoria"]
        UC14["UC14: Gerenciar Usuários e Vínculos de UBS (RF001, RF025)"]
        UC15["UC15: Consultar Log Imutável de Auditoria (RF028)"]
    end

    FR --> UC01 & UC02 & UC03 & UC04 & UC05 & UC06 & UC07
    FR --> UC08 & UC09 & UC10 & UC11

    FRes --> UC01 & UC02 & UC03 & UC04 & UC05 & UC06
    FRes --> UC08 & UC09 & UC10

    Ger --> UC01 & UC04 & UC07 & UC08 & UC15

    Adm --> UC01 & UC08 & UC11 & UC14 & UC15

    UC02 -.->|"extend (se validade < 180d)"| UC10
    UC02 & UC03 & UC05 & UC06 & UC11 -.->|"include (dispara recálculo)"| UC12
    Sys --> UC12
    UC12 -.->|"include (grava Outbox se crítico)"| UC13
```

---

## 2. Detalhamento dos Casos de Uso do Épico 6 (Alertas e Notificações)

| Código | Caso de Uso | Atores Primários | Requisitos | Regra Síntese |
| --- | --- | --- | --- | --- |
| **UC08** | Consultar Central de Alertas (Vencimento e Ruptura) | Todos os perfis da UBS | RF022, RF023 | Exibe alertas divididos nas abas "Próximos ao Vencimento" e "Risco de Ruptura", ordenados por severidade (`CRITICO`, `ATENCAO`). |
| **UC09** | Confirmar Leitura de Alertas | Farmacêutico RT, Residente | RF022, RF023 | Transiciona o alerta de `ATIVO` para `LIDO`, atualizando o contador do sino no cabeçalho Web e do badge no App Mobile. |
| **UC10** | Confirmar Recebimento de Lote com Validade Curta | Farmacêutico RT, Residente | RF024, RF028 | Caso de uso `<<extend>>` de `UC02`: bloqueia a entrada de lotes com validade $< 180$ dias até que o profissional marque ciência explícita, registrando auditoria. |
| **UC11** | Configurar Parâmetros Operacionais da UBS | Farmacêutico RT, Administrador | RF026, RF027, RF028 | Altera `limiarVencimentoDias`, `estoqueSegurancaDias`, `cafLeadTimeDays` e preferências de e-mail da UBS, disparando recálculo imediato (`UC12`) e auditoria. |
| **UC12** | Avaliar Cobertura e Vencimentos Automaticamente | Sistema / Gatilho Transacional | RF022, RF023, ADR-010 | Calcula a validade de cada lote ativo e a cobertura consolidada por medicamento ($\text{Saldo Válido} / \text{CMD}$), abrindo novos alertas ou auto-resolvendo os normalizados. |
| **UC13** | Enviar Notificações por E-mail e Push Local | Worker Outbox / App Mobile | RF022, RF023, ADR-004 | Consome `outbox_events` com idempotência diária para enviar e-mail ao Farmacêutico Responsável e dispara notificação local no celular via `expo-notifications`. |

---

## 3. Diagrama de Classes de Domínio (UML `classDiagram`)

O diagrama de classes abaixo representa o modelo de domínio rico do FarmaUBS, destacando em especial as entidades, objetos de valor e serviços de domínio introduzidos pelo **Épico 6 (Incremento 2)** e sua integração com o núcleo operacional do **Incremento 1**.

```mermaid
classDiagram
    class Municipio {
        +UUID id
        +String nome
        +String uf
        +String codigoIbge
        +Boolean ativo
    }

    class UnidadeSaude {
        +UUID id
        +UUID municipioId
        +String nome
        +String cnes
        +String endereco
        +String responsavelTecnico
        +Int cafLeadTimeDays
        +Boolean ativo
    }

    class Usuario {
        +UUID id
        +UUID municipioId
        +String nomeCompleto
        +String email
        +PerfilCodigo perfilCodigo
        +UUID[] unidadeIds
        +Boolean ativo
        +podeConfigurarParametrosUbs() Boolean
    }

    class ParametroOperacionalUbs {
        +UUID id
        +UUID municipioId
        +UUID ubsId
        +Int limiarVencimentoDias
        +Int estoqueSegurancaDias
        +Int cafLeadTimeDays
        +Int janelaConsumoDias
        +Boolean notificarEmailVencimento
        +Boolean notificarEmailRuptura
        +UUID atualizadoPorId
        +DateTime updatedAt
        +calcularPontoPedidoDias() Int
        +validarLimitesSanitarios() void
    }

    class Produto {
        +UUID id
        +String codigoCatmat
        +String principioAtivo
        +String nomeComercial
        +String dosagem
        +String formaFarmaceutica
        +String apresentacao
        +String categoria
        +Boolean antimicrobiano
        +Boolean controlado
    }

    class Lote {
        +UUID id
        +UUID municipioId
        +UUID ubsId
        +UUID produtoId
        +UUID fabricanteId
        +String numeroLote
        +Date dataValidade
        +Int saldoAtual
        +calcularDiasParaVencer(Date referencia) Int
        +estaVencido(Date referencia) Boolean
        +possuiValidadeCurtaRecebimento(Date referencia) Boolean
    }

    class AlertaEstoque {
        +UUID id
        +UUID municipioId
        +UUID ubsId
        +UUID produtoId
        +UUID loteId
        +TipoAlertaEstoque tipoAlerta
        +SeveridadeAlertaEstoque severidade
        +StatusAlertaEstoque status
        +String titulo
        +String descricao
        +Int saldoAtual
        +Decimal consumoMedioDiario
        +Int coberturaDias
        +Int diasParaVencer
        +Date dataValidade
        +UUID lidoPorId
        +DateTime lidoEm
        +DateTime resolvidoEm
        +String motivoResolucao
        +marcarComoLido(UUID usuarioId) void
        +resolverAutomaticamente(String motivo) void
        +atualizarSeveridadeEMetricas(SeveridadeAlertaEstoque sev, Int saldo, Int metrica) void
    }

    class OutboxEvent {
        +UUID id
        +UUID municipioId
        +UUID ubsId
        +String aggregateType
        +UUID aggregateId
        +String eventType
        +String idempotencyKey
        +JSON payload
        +StatusOutboxEvent status
        +Int tentativas
        +DateTime proximaTentativaEm
        +String erroMensagem
        +DateTime processedAt
        +marcarProcessado() void
        +registrarFalhaComBackoff(String erro) void
    }

    class AvaliadorAlertasDomainService {
        +avaliarVencimentoLote(Lote lote, ParametroOperacionalUbs params, Date hoje) ResultadoAvaliacaoVencimento
        +avaliarRupturaProduto(Produto prod, Lote[] lotesUbs, Decimal cmd, ParametroOperacionalUbs params) ResultadoAvaliacaoRuptura
        +calcularConsumoMedioDiario(Int totalDispensadoJanela, Int janelaDias) Decimal
    }

    Municipio "1" --> "0..*" UnidadeSaude : possui
    UnidadeSaude "1" --> "1" ParametroOperacionalUbs : configura (RF027)
    UnidadeSaude "1" --> "0..*" Lote : armazena
    UnidadeSaude "1" --> "0..*" AlertaEstoque : monitora
    UnidadeSaude "1" --> "0..*" OutboxEvent : enfileira eventos
    Usuario "0..*" --> "1..*" UnidadeSaude : atua em (user_units)
    Produto "1" --> "0..*" Lote : especifica
    Produto "1" --> "0..*" AlertaEstoque : monitorado por
    Lote "0..1" --> "0..*" AlertaEstoque : origina alerta de validade
    AlertaEstoque "1" --> "0..*" OutboxEvent : dispara notificação (ADR-004)
    AvaliadorAlertasDomainService ..> ParametroOperacionalUbs : lê limiares
    AvaliadorAlertasDomainService ..> Lote : avalia saldos e validades
    AvaliadorAlertasDomainService ..> AlertaEstoque : abre, atualiza ou resolve
```

---

## 4. Diagrama de Estados do Ciclo de Vida do Alerta (`stateDiagram-v2`)

```mermaid
stateDiagram-v2
    [*] --> ATIVO : Condição detectada\n(Validade <= Limiar ou Cobertura <= Ponto Crítico)

    ATIVO --> LIDO : Farmacêutico confirma leitura\n(PATCH /api/v1/alertas/:id/lido)
    ATIVO --> ATIVO : Reavaliação mantém condição\n(Atualiza saldo, cobertura ou severidade)
    LIDO --> LIDO : Reavaliação mantém mesma severidade
    LIDO --> ATIVO : Escalonamento de severidade\n(Ex: ATENCAO evolui para CRITICO)

    ATIVO --> RESOLVIDO : Auto-resolução pelo motor\n(Entrada CAF recompôs saldo ou lote zerado/descartado)
    LIDO --> RESOLVIDO : Auto-resolução pelo motor\n(Condição física normalizada no estoque)

    RESOLVIDO --> [*]
```
