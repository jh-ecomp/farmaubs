# language: pt
Funcionalidade: Jornada E2E Full-Stack de Acesso, Sessão Cookie HttpOnly e RBAC (Camadas C e D)

  Como farmacêutico responsável pela UBS de Parnaíba
  Quero realizar login contra o servidor HTTP real, validar a ausência de token em localStorage e verificar o bloqueio RBAC em rotas administrativas
  Para comprovar a segurança da sessão HttpOnly de ponta a ponta (AC-16 a AC-31)

  Cenário: Login full-stack, expurgo de token no localStorage e proteção RBAC
    Dado que o servidor de backend está com o estoque inicial da UBS de Parnaíba carregado
    Quando o usuário acessa a página pública "/login"
    E ele preenche o e-mail "farma.parnaiba@farmaubs.dev" e a senha "Farma@123456" e aciona "Entrar no FarmaUBS"
    Então ele deve ser redirecionado para a bancada operacional da UBS
    E o "localStorage" do navegador não deve conter a chave "@FarmaUBS:token"
    Quando ele tentar navegar diretamente para a rota "/usuarios"
    Então a tela de "Acesso Não Autorizado" deve ser exibida bloqueando a operação
