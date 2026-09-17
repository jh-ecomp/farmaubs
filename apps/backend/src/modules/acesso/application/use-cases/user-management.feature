# language: pt
Funcionalidade: Gestão de Usuários, Senha Provisória e Auditoria (RF025, RF003)

  Cenário: Edição de dados cadastrais com sucesso
    Dado que existe um usuário cadastrado com e-mail "joao@ubs.gov.br"
    Quando o Administrador atualiza o nome para "João Silva Santos" e o e-mail para "joao.santos@ubs.gov.br"
    Então os novos dados devem ser persistidos
    E um evento de auditoria "EDICAO_DADOS" deve ser registrado

  Cenário: Rejeição de alteração de e-mail para endereço já existente
    Dado que existe um usuário com e-mail "maria@ubs.gov.br"
    E outro usuário com e-mail "conflito@ubs.gov.br"
    Quando o Administrador tenta alterar o e-mail de "maria@ubs.gov.br" para "conflito@ubs.gov.br"
    Então a operação deve ser rejeitada por conflito de e-mail

  Cenário: Atualização atômica de perfil e associações de UBSs
    Dado que existe um usuário vinculado à UBS "UBS Central" com perfil "FARMACEUTICO"
    Quando o Administrador altera o perfil para "GESTOR" e vincula às UBSs "UBS Central" e "UBS Norte"
    Então as novas associações devem ser sincronizadas
    E um evento de auditoria "MUDANCA_PERFIL_UBSS" deve ser registrado

  Cenário: Rejeição de vínculo a UBS de outro município
    Dado que existe um usuário pertencente ao município "Parnaíba"
    Quando o Administrador tenta vincular o usuário a uma UBS do município "Teresina"
    Então a operação deve ser rejeitada por violação de integridade territorial

  Cenário: Inativação de usuário com revogação imediata de sessões
    Dado que existe um usuário ativo com sessões ativas no sistema
    Quando o Administrador inativa a conta do usuário
    Então o status do usuário deve ser alterado para inativo
    E todas as suas sessões ativas devem ser revogadas imediatamente
    E um evento de auditoria "INATIVACAO" deve ser registrado

  Cenário: Bloqueio de auto-inativação pelo administrador
    Dado que o Administrador está logado com ID "admin-1"
    Quando ele tenta inativar a própria conta "admin-1"
    Então a operação deve ser bloqueada

  Cenário: Trava do último administrador ativo
    Dado que existe apenas um administrador ativo no sistema
    Quando é feita uma tentativa de inativar esse administrador
    Então a operação deve ser rejeitada por ser o último administrador

  Cenário: Redefinição de senha provisória com reset de bloqueios
    Dado que existe um usuário com conta bloqueada após tentativas falhas
    Quando o Administrador define uma nova senha provisória "SenhaForte#2026"
    Então a nova senha deve ser hasheada com BCrypt custo 12
    E a flag deve_trocar_senha deve ser marcada como verdadeira
    E o bloqueio da conta deve ser removido
    E todas as sessões ativas do usuário devem ser revogadas
    E um evento de auditoria "REDEFINICAO_SENHA_PROVISORIA" deve ser registrado

  Cenário: Rejeição de senha provisória fraca
    Dado que existe um usuário cadastrado no sistema
    Quando o Administrador tenta definir a senha provisória "fraca123"
    Então a operação deve ser rejeitada por não atender aos requisitos de complexidade

