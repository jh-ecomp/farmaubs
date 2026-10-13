# language: pt
Funcionalidade: Porta de Sessão e Snapshot de Escopo (Camadas A e C)

  Cenário: Geração de token criptográfico e persistência de hash SHA-256
    Dado que o serviço solicita a criação de sessão para o usuário "user-uuid-1"
    Quando o método criarSessao for executado
    Então um token em texto puro de 64 caracteres hexadecimais deve ser retornado
    E o adaptador deve gravar o hash SHA-256 desse token na tabela sessions
    E o token em texto puro jamais deve ser gravado no banco

  Cenário: Lookup com mock da porta retorna snapshot completo de segurança
    Dado que existe uma sessão ativa registrada
    Quando o método buscarPorTokenHash for chamado com o hash válido
    Então o snapshot retornado deve conter o perfilCodigo "FARMACEUTICO_RESPONSAVEL"
    E a lista unidadeIds com as UBSs vinculadas ao usuário
    E o status "ativa"

  Cenário: Rejeição de sessão com tempo expirado
    Dado que o token apresentado pertence a uma sessão com expira_em no passado
    Quando o método buscarPorTokenHash for executado
    Então o retorno deve ser nulo
