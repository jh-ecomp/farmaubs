# language: pt
Funcionalidade: Teste de Integração do Repositório de Usuários no PostgreSQL Real (Camada B, ADR-030)

  Como adaptador de infraestrutura TypeOrmUserRepository
  Quero persistir e consultar usuários e associações user_units diretamente no PostgreSQL efêmero
  Para provar que as queries, índices, constraints e transações funcionam conforme esperado no banco real

  Contexto:
    Dado que o banco PostgreSQL está operacional com município, perfil e UBSs previamente semeados

  Cenário: Persistência real de usuário e vínculos user_units no PostgreSQL
    Dado que recebo os dados de criação para o usuário "Roberto Martins" com e-mail "roberto@repo-integration.test" e senha hash "$2b$12$hashedPasswordExampleValue"
    E que informo as UBSs cadastradas para o vínculo
    Quando eu executo o método salvar do TypeOrmUserRepository conectado ao banco real
    Então o usuário deve ser persistido fisicamente na tabela users com status ativo
    E as associações correspondentes devem ser persistidas fisicamente na tabela user_units com ativo verdadeiro

  Cenário: Busca de usuário por e-mail com case-insensitivity contra índice real do banco
    Dado que o usuário com e-mail "roberto@repo-integration.test" está persistido no PostgreSQL
    Quando eu busco pelo e-mail em maiúsculas "ROBERTO@REPO-INTEGRATION.TEST"
    Então o usuário correspondente deve ser retornado pelo repositório com o e-mail em minúsculas

  Cenário: Verificação de existência de e-mail no banco real
    Dado que o usuário com e-mail "roberto@repo-integration.test" está persistido no PostgreSQL
    Quando eu verifico a existência do e-mail "Roberto@repo-integration.test"
    Então a verificação no repositório deve retornar verdadeiro
    E a verificação para o e-mail "inexistente@repo-integration.test" deve retornar falso

  Cenário: Garantia de rollback transacional real ao tentar associar uma UBS inexistente
    Dado que recebo os dados de criação para o usuário "Juliana Costa" com e-mail "juliana@repo-integration.test"
    Mas a lista de UBSs contém um identificador inexistente "00000000-0000-0000-0000-000000000999"
    Quando eu tento executar o método salvar do TypeOrmUserRepository
    Então o salvamento deve falhar com violação de chave estrangeira
    E o usuário "juliana@repo-integration.test" não deve existir fisicamente na tabela users devido ao rollback

