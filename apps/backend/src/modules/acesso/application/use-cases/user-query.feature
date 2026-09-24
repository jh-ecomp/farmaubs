# language: pt
Funcionalidade: Consulta e Listagem de Usuários (Camada A)
  Cenário: Listagem paginada padrão com contagem correta
    Dado que existem 25 usuários cadastrados no repositório
    Quando o caso de uso ListUsersUseCase for executado com página 1 e limite 10
    Então o resultado deve conter 10 itens
    E o total de itens deve ser 25
    E o total de páginas deve ser 3

  Cenário: Filtro combinado de busca textual e município
    Dado que existem usuários em "Santos" e em "São Paulo"
    E o usuário "Carlos Eduardo" pertence a "Santos" com e-mail "carlos@santos.gov.br"
    Quando o Administrador buscar pelo termo "carlos" filtrando pelo ID de "Santos"
    Então apenas o usuário "Carlos Eduardo" deve ser retornado

  Cenário: Consulta de detalhe de usuário por ID com sucesso
    Dado que existe um usuário com ID "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"
    E o usuário possui 2 UBSs vinculadas
    Quando o caso de uso GetUserByIdUseCase for executado com o ID "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"
    Então os detalhes do usuário devem ser retornados com sucesso
    E a lista de UBSs vinculadas deve conter 2 unidades
    E a senha hash não deve estar presente no resultado

  Cenário: Consulta de usuário por ID inexistente
    Dado que não existe um usuário com ID "b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22"
    Quando o caso de uso GetUserByIdUseCase for executado com o ID "b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22"
    Então uma exceção UsuarioNaoEncontradoException deve ser lançada
