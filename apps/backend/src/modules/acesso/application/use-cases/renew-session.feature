# language: pt
Funcionalidade: Renovação Deslizante e Timeout no Backend (Camada A)

  Cenário: Requisição autenticada prorroga o prazo da sessão
    Dado que existe uma sessão ativa com expira_em para daqui a 20 minutos
    Quando o SessionAuthGuard processar a requisição com o token correspondente
    Então o método renovarAtividade do repositório deve ser acionado
    E o novo expira_em deve ser postergado para 60 minutos à frente
    E a requisição prossegue com sucesso

  Cenário: Sessão expirada é barrada pelo guard
    Dado que existe uma sessão com expira_em no passado (expirada há 1 minuto)
    Quando o SessionAuthGuard interceptar a requisição
    Então deve interromper a execução e retornar status HTTP 401 Unauthorized

  Cenário: Requisição dentro da janela de throttle não dispara update no banco
    Dado que existe uma sessão ativa com última atividade há menos de 30 segundos
    Quando o SessionAuthGuard processar a requisição com o token correspondente
    Então o método renovarAtividade do repositório não deve ser acionado
    E a requisição prossegue com sucesso

  Cenário: Renovação explícita da sessão via caso de uso
    Dado que um usuário possui uma sessão ativa identificada por "sessao-123"
    Quando o caso de uso de renovação de sessão for executado
    Então deve persistir a nova data de expiração no repositório
    E deve retornar os metadados de expiração com ttl de 3600 segundos e aviso de 300 segundos

