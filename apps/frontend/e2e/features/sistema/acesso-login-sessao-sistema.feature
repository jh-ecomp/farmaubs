# language: pt
Funcionalidade: Autenticação, Sessão HttpOnly, Timeout de Inatividade e RBAC (Camada D)

  Como profissional de saúde e usuário do FarmaUBS
  Quero autenticar com segurança via cookie HttpOnly, receber aviso 5 minutos antes do timeout de sessão e ter rotas protegidas por perfil RBAC
  Para garantir a segurança dos dados clínicos e conformidade com LGPD e WCAG 2.1 AA (RF002, RF004, NF009, NF012, ADR-006, ADR-032)

  Cenário: Login institucional com cookie HttpOnly sem vazamento de token no localStorage e auditoria WCAG 2.1 AA
    Dado que as APIs de autenticação do módulo de acesso estão operacionais
    E que o usuário acessa a página pública "/login"
    Quando ele preenche o e-mail "farma.parnaiba@farmaubs.dev" e a senha "Farma@123456" e aciona "Entrar no FarmaUBS"
    Então ele deve ser redirecionado para a bancada operacional da UBS
    E o "localStorage" do navegador não deve conter a chave "@FarmaUBS:token"
    E a tela de acesso não deve apresentar violações críticas de acessibilidade WCAG 2.1 AA

  Cenário: Exibição do modal de aviso de inatividade 5 minutos antes da expiração e renovação da sessão
    Dado que o farmacêutico está autenticado com sessão ativa prestes a entrar na janela de aviso de 5 minutos
    Quando o relógio do navegador atingir a janela de aviso de inatividade
    Então o modal de aviso de expiração de sessão deve ser exibido na tela
    Quando o farmacêutico clicar em "Continuar Conectado"
    Então a requisição POST para "/api/v1/acesso/renovar" deve ser enviada
    E o modal de aviso deve ser fechado mantendo a sessão ativa

  Cenário: Bloqueio RBAC ao tentar acessar gestão administrativa de usuários com perfil de Farmacêutico
    Dado que as APIs de autenticação do módulo de acesso estão operacionais
    E que o usuário autenticado possui perfil "FARMACEUTICO_RESPONSAVEL"
    Quando ele tentar navegar diretamente para a rota "/usuarios"
    Então a tela de "Acesso Não Autorizado" deve ser exibida bloqueando a operação
