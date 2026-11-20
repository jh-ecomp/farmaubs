# language: pt
Funcionalidade: Gestão Administrativa de Usuários e Troca Obrigatória de Senha Provisória (Camada D)

  Como administrador e usuário em primeiro acesso no FarmaUBS
  Quero gerenciar contas institucionais no painel administrativo e realizar a troca obrigatória de senha provisória
  Para manter a governança de acessos das UBS de Parnaíba (RF001, RF002, RF003, RF025)

  Cenário: Fluxo de troca obrigatória de senha provisória no primeiro acesso
    Dado que o usuário autenticado possui a flag "deveTrocarSenha" ativa no primeiro acesso
    Quando ele acessar a tela "/trocar-senha" e preencher a senha atual "Provisoria@123" e a nova senha forte "Definitiva@2026"
    E confirmar a alteração clicando em "Salvar Nova Senha"
    Então o sistema deve confirmar a atualização da senha e liberar o acesso à bancada da UBS

  Cenário: Acesso autorizado do Administrador ao painel de Gestão de Usuários
    Dado que o usuário autenticado possui perfil "ADMINISTRADOR" e as APIs administrativas estão operacionais
    Quando ele acessar o painel "/usuarios"
    Então a listagem de usuários cadastrados deve exibir "Dra. Maria das Graças"
