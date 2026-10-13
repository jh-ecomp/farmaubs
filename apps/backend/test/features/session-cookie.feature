# language: pt
Funcionalidade: Transporte de Sessão via Cookie Seguro HttpOnly (AC-29)

  Cenário: Emissão bem-sucedida de cookie HttpOnly no login
    Dado que o usuário envia credenciais válidas para "POST /api/v1/acesso/login"
    Quando a requisição é processada com sucesso
    Então a resposta deve retornar status 200 OK
    E o cabeçalho "Set-Cookie" deve conter "farmaubs_session="
    E o cookie deve conter a diretiva "HttpOnly"
    E o cookie deve conter a diretiva "Path=/api/v1"
    E o cookie deve conter a diretiva "SameSite=Lax"

  Cenário: Autenticação em rota protegida utilizando apenas o cookie
    Dado que a requisição para "GET /api/v1/acesso/me" possui o cookie "farmaubs_session" com token válido
    E a requisição não possui cabeçalho "Authorization"
    Quando a requisição passa pelo SessionAuthGuard
    Então a requisição deve ser autorizada
    E o usuário autenticado deve ser injetado no contexto

  Cenário: Autenticação em rota protegida via cabeçalho Authorization (App Mobile)
    Dado que a requisição para "GET /api/v1/acesso/me" não possui cookie
    E a requisição possui cabeçalho "Authorization: Bearer <token_valido>"
    Quando a requisição passa pelo SessionAuthGuard
    Então a requisição deve ser autorizada
    E o usuário autenticado deve ser injetado no contexto

  Cenário: Rejeição de requisição sem cookie e sem cabeçalho Authorization
    Dado que a requisição para "GET /api/v1/acesso/me" não possui cookie "farmaubs_session"
    E a requisição não possui cabeçalho "Authorization"
    Quando a requisição passa pelo SessionAuthGuard
    Então a resposta deve ser 401 Unauthorized com mensagem "Token de autenticação ausente ou inválido"

  Cenário: Expurgo de cookie no logout
    Dado que o usuário possui sessão ativa informada via cookie "farmaubs_session"
    Quando o usuário executa "POST /api/v1/acesso/logout"
    Então a sessão deve ser marcada como revogada no banco de dados
    E a resposta deve retornar status 204 No Content
    E o cabeçalho "Set-Cookie" deve invalidar "farmaubs_session" com Max-Age zerado
