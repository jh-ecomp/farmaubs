# language: pt
Funcionalidade: Login (RF002)
  Como usuário do FarmaUBS (qualquer perfil)
  Quero acessar o sistema informando e-mail e senha
  Para que apenas usuários legítimos iniciem sessão

  Cenário: Credenciais válidas iniciam sessão
    Dado que existe um usuário ativo com e-mail "admin@farmaubs.dev"
    Quando eu informar o e-mail "admin@farmaubs.dev" e a senha correta
    Então uma sessão é criada com token único
    E o contador de tentativas inválidas é zerado

  Cenário: Senha incorreta retorna mensagem genérica e incrementa tentativas
    Dado que existe um usuário ativo com e-mail "admin@farmaubs.dev"
    Quando eu informar a senha errada para esse e-mail
    Então o sistema retorna a mensagem genérica de credenciais inválidas
    E nenhuma sessão é criada

  Cenário: Quinta tentativa inválida bloqueia a conta por 15 minutos
    Dado que o usuário "gestor@farmaubs.dev" possui 4 tentativas inválidas registradas
    Quando eu informar a senha errada pela 5ª vez
    Então o sistema bloqueia a conta
    E retorna a mensagem de credenciais inválidas

  Cenário: Tentativa com conta bloqueada não cria sessão
    Dado que a conta "gestor@farmaubs.dev" está bloqueada
    Quando eu tentar logar com credenciais corretas
    Então o sistema retorna erro informando o tempo restante de bloqueio
    E o contador de tentativas não é incrementado

  Cenário: E-mail não cadastrado recebe a mesma mensagem genérica
    Dado que não existe usuário com o e-mail "nao.cadastrado@farmaubs.dev"
    Quando eu tentar logar com esse e-mail e qualquer senha
    Então o sistema retorna a mesma mensagem genérica de credenciais inválidas

  Cenário: Login válido após tentativas inválidas zera o contador
    Dado que o usuário "farmaceutico.responsavel@farmaubs.dev" possui 2 tentativas inválidas registradas
    Quando eu logar com a senha correta
    Então a sessão é criada com sucesso
    E o contador de tentativas é zerado

  Cenário: Sessão inativa por 60 minutos é encerrada
    Dado que o usuário "admin@farmaubs.dev" possui uma sessão ativa expirada
    Quando o sistema verificar a sessão
    Então a sessão é recusada por expiração