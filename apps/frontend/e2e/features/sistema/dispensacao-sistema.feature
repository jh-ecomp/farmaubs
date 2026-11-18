# language: pt
Funcionalidade: Fluxo Completo da Tela Principal de Dispensação (Camada D)

  Como farmacêutico operando o módulo de dispensação na UBS
  Quero uma tela principal dividida em etapas operacionais claras (Identificação do Paciente -> Seleção FEFO -> Carrinho -> Confirmação e Baixa)
  Para realizar o fluxo completo de saída de medicamentos em poucos cliques com acessibilidade WCAG 2.1 AA (RF010, NF010, ADR-032)

  Contexto:
    Dado que as APIs da bancada de dispensação da UBS estão operacionais
    E que o farmacêutico autenticado acessa a tela principal de dispensação

  Cenário: Habilitação do botão de finalizar após preenchimento completo e auditoria WCAG 2.1 AA
    Dado que o farmacêutico preenche os 4 dados obrigatórios do paciente
    E adiciona 1 medicamento válido com lote FEFO ao carrinho
    Quando todos os critérios estiverem válidos
    Então o botão "Finalizar Atendimento" deve se tornar clicável
    E a tela de dispensação não deve apresentar violações críticas de acessibilidade WCAG 2.1 AA

  Cenário: Abertura e confirmação do modal de atendimento com limpeza da tela após gravação
    Dado que o farmacêutico preenche os 4 dados obrigatórios do paciente
    E adiciona 1 medicamento válido com lote FEFO ao carrinho
    Quando o farmacêutico clica em "Finalizar Atendimento"
    Então o modal de confirmação deve listar os dados do paciente e o resumo dos itens
    Quando o farmacêutico clica em "Confirmar Baixa de Estoque" e a API responde com 201 Created
    Então uma mensagem de sucesso do atendimento deve ser exibida
    E os campos de paciente e o carrinho da receita devem ser resetados para novo atendimento
