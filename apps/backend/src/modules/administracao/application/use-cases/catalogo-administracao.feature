# language: pt
Funcionalidade: Catálogo de Administração (Municípios e UBSs)
  Como usuário autenticado
  Quero consultar a listagem de municípios e unidades de saúde
  Para popular seletores de lotação municipal e UBS em cascata

  Cenário: Consulta de municípios com sessão válida
    Dado que o usuário está autenticado com sessão válida
    E existem municípios ativos cadastrados no banco de dados
    Quando uma requisição "GET /api/v1/administracao/municipios" for executada
    Então o sistema deve responder com HTTP 200 OK
    E o corpo da resposta deve ser um array contendo os municípios ordenados alfabeticamente por nome
    E cada item deve conter "id", "nome", "uf" e "ibgeCode"

  Cenário: Consulta de UBSs informando municipioId válido
    Dado que o usuário está autenticado com sessão válida
    E existem UBSs cadastradas para o município "01a06db9-c4af-7944-8ec5-c9b9443b054e"
    Quando uma requisição "GET /api/v1/administracao/unidades-saude?municipioId=01a06db9-c4af-7944-8ec5-c9b9443b054e" for executada
    Então o sistema deve responder com HTTP 200 OK
    E o corpo da resposta deve ser um array com as unidades pertencentes àquele município ordenadas por nome
    E cada item deve conter "id", "municipioId", "nome", "endereco", "responsavelTecnico" e "cafLeadTimeDays"

  Cenário: Consulta de UBSs sem informar municipioId
    Dado que o usuário está autenticado com sessão válida
    Quando uma requisição "GET /api/v1/administracao/unidades-saude" for executada sem o parâmetro "municipioId"
    Então o sistema deve responder com HTTP 400 Bad Request
    E a mensagem deve indicar "O parâmetro 'municipioId' é obrigatório para consulta de unidades de saúde."

  Cenário: Tentativa de consulta de catálogo sem autenticação
    Dado que a requisição não possui cabeçalho "Authorization" com Bearer token válido
    Quando uma requisição "GET /api/v1/administracao/municipios" for executada
    Então o sistema deve responder com HTTP 401 Unauthorized


