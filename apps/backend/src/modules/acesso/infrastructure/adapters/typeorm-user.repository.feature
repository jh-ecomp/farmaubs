# language: pt
Funcionalidade: Adaptador de Repositório de Usuários (TypeORM)

  Como sistema FarmaUBS
  Quero persistir usuários na tabela users e suas associações na tabela user_units
  Com integridade e garantia de atomicidade transacional
  Para manter o escopo de unidades vinculado corretamente a cada usuário

  Contexto:
    Dado que o adaptador de repositório TypeOrmUserRepository está inicializado

  Cenário: Salvar novo usuário com perfil e múltiplas UBSs com sucesso
    Dado que recebo dados válidos de criação para o usuário "Carlos Eduardo" com e-mail "carlos@ubs.gov.br"
    E que associo o usuário às UBSs "11111111-1111-1111-1111-111111111111" e "22222222-2222-2222-2222-222222222222"
    Quando eu invoco o método salvar do repositório
    Então a entidade User deve ser salva com os dados normalizados
    E os registros de UserUnit devem ser salvos vinculando o usuário a cada UBS
    E o modelo de domínio do usuário criado deve ser retornado

  Cenário: Salvar usuário deduplicando IDs de UBS duplicadas
    Dado que recebo dados válidos de criação para o usuário "Mariana Dias" com e-mail "mariana@ubs.gov.br"
    E que a lista de UBSs contém IDs repetidos "11111111-1111-1111-1111-111111111111"
    Quando eu invoco o método salvar do repositório
    Então apenas registros únicos devem ser persistidos em UserUnit

  Cenário: Buscar usuário existente por e-mail com sucesso
    Dado que existe um registro de usuário com e-mail "carlos@ubs.gov.br" no banco
    Quando eu busco o usuário pelo e-mail "carlos@ubs.gov.br"
    Então o modelo de domínio correspondente deve ser retornado

  Cenário: Buscar usuário por e-mail com variação de caixa (case-insensitive)
    Dado que existe um registro de usuário com e-mail "carlos@ubs.gov.br" no banco
    Quando eu busco o usuário pelo e-mail "CARLOS@UBS.GOV.BR"
    Então a consulta deve ser executada em caixa baixa e retornar o usuário

  Cenário: Buscar usuário por e-mail inexistente retornando nulo
    Dado que não existe nenhum usuário cadastrado com o e-mail "inexistente@ubs.gov.br"
    Quando eu busco o usuário pelo e-mail "inexistente@ubs.gov.br"
    Então o resultado retornado deve ser nulo

  Cenário: Verificar existência de usuário por e-mail retornando verdadeiro
    Dado que existe um registro de usuário com e-mail "carlos@ubs.gov.br" no banco
    Quando eu verifico a existência do e-mail "Carlos@UBS.gov.br"
    Então a verificação deve retornar verdadeiro

  Cenário: Verificar existência por e-mail inexistente retornando falso
    Dado que não existe nenhum usuário cadastrado com o e-mail "naoexiste@ubs.gov.br"
    Quando eu verifico a existência do e-mail "naoexiste@ubs.gov.br"
    Então a verificação deve retornar falso

  Cenário: Reversão transacional (rollback) caso ocorra erro ao salvar user_units
    Dado que recebo dados de criação para o usuário "Lucas Mendes"
    Mas ocorre um erro de banco ao tentar salvar os registros de UserUnit
    Quando eu invoco o método salvar do repositório
    Então a exceção deve ser lançada e a transação deve ser abortada

