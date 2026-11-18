# language: pt
Funcionalidade: Jornada E2E Full-Stack de Dispensação de Medicamentos na UBS (Camadas C e D)

  Como farmacêutico responsável pela UBS de Parnaíba
  Quero autenticar no sistema, registrar a dispensação de um medicamento pelo lote FEFO e consultar o atendimento gravado no histórico
  Para validar a integração de ponta a ponta entre Frontend React, Sessão HttpOnly e API Backend (RF002, RF010, RF012)

  Cenário: Login institucional, baixa transacional por FEFO e conferência no histórico da UBS
    Dado que o servidor de backend está com o estoque inicial da UBS de Parnaíba carregado
    Quando o farmacêutico realiza login com o e-mail "farma.parnaiba@farmaubs.dev" e senha "Farma@123456"
    Então ele deve ser redirecionado para a bancada de "Dispensação de Medicamentos"
    Quando o farmacêutico preenche os 4 dados obrigatórios do paciente
    E adiciona 1 medicamento válido com lote FEFO ao carrinho
    E o farmacêutico clica em "Finalizar Atendimento"
    E confirma a baixa clicando em "Confirmar Baixa de Estoque"
    Então uma mensagem de sucesso do atendimento deve ser exibida
    Quando o farmacêutico alterna para a aba "Histórico de Atendimentos"
    Então o novo atendimento do paciente "Ana Paula Mendes" deve constar na tabela como "Concluída"
