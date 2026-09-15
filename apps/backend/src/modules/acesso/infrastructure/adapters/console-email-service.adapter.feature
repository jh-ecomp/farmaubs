# language: pt
Funcionalidade: Adaptador de Simulação de Envio de E-mail via Console

  Como módulo de acesso do FarmaUBS
  Quero disparar uma notificação de e-mail simulada com saída no console
  Para registrar que o cadastro foi concluído e simular o envio de e-mail de confirmação
  Enquanto o serviço definitivo de mensageria/SMTP não estiver em operação

  Contexto:
    Dado que o adaptador ConsoleEmailServiceAdapter está instanciado

  Cenário: Disparo de e-mail de confirmação emitindo log no console com sucesso
    Dado que recebo a solicitação de envio para o usuário "Carlos Eduardo" com e-mail "carlos@ubs.gov.br"
    Quando eu invoco o método enviarConfirmacaoCadastro
    Então a notificação deve ser emitida no console informando o sucesso do envio
    E a mensagem deve conter o identificador de serviço "[EMAIL SERVICE]"

  Cenário: Garantia de formatação legível contendo nome completo e e-mail institucional
    Dado que recebo a solicitação de envio para o usuário "Dra. Beatriz Santos" com e-mail "beatriz.santos@ubs.gov.br"
    Quando eu invoco o método enviarConfirmacaoCadastro
    Então a mensagem emitida deve conter o nome "Dra. Beatriz Santos"
    E a mensagem emitida deve conter o e-mail "<beatriz.santos@ubs.gov.br>"

  Cenário: Normalização e limpeza de espaços extras ao enviar notificação
    Dado que recebo a solicitação com espaços extras no nome "  Fernanda Lima  " e e-mail "  FERNANDA@UBS.GOV.BR  "
    Quando eu invoco o método enviarConfirmacaoCadastro
    Então o nome deve ser impresso sem espaços desnecessários "Fernanda Lima"
    E o e-mail deve ser impresso em minúsculas e sem espaços "fernanda@ubs.gov.br"

