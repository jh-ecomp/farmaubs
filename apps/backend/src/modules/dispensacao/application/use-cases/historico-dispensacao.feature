# language: pt
Funcionalidade: Consulta de Histórico de Dispensas e Exportação XLSX (Camada A)

  Cenário: Aplicação do filtro padrão temporal de ontem e hoje
    Dado que existem dispensas realizadas há 5 dias, ontem e hoje
    Quando o caso de uso ListarDispensacoesUseCase for executado sem informar datas
    Então o resultado deve conter apenas as dispensas realizadas entre ontem e hoje
    E as datas efetivas retornadas devem corresponder a ontem e hoje

  Cenário: Filtro por range customizado de datas e identificação de paciente
    Dado que o usuário define o período de "2026-09-01" até "2026-09-30"
    E busca pelo CPF "12345678909"
    Quando o caso de uso de listagem for executado
    Então apenas os atendimentos do paciente no mês de setembro devem ser retornados

  Cenário: Estorno de atendimento com devolução de saldo ao lote
    Dado uma dispensação com status "concluida" que retirou 15 unidades do lote "LOT-X"
    Quando o farmacêutico solicitar o estorno com motivo "Paciente desistiu da retirada"
    Então o status da dispensação deve mudar para "estornada"
    E o saldo do lote "LOT-X" deve ser incrementado em 15 unidades

