# language: pt
Funcionalidade: Guards de Autorização RBAC e Tenant (Camadas A e C)

  Cenário: Usuário com perfil permitido acessa a rota
    Dado que a rota está anotada com @Roles(ADMINISTRADOR)
    E o usuário na requisição possui o perfil "ADMINISTRADOR"
    Quando o RolesGuard avaliar a execução
    Então o guard deve retornar verdadeiro

  Cenário: Usuário com perfil sem permissão recebe 403
    Dado que a rota está anotada com @Roles(ADMINISTRADOR)
    E o usuário na requisição possui o perfil "FARMACEUTICO_RESPONSAVEL"
    Quando o RolesGuard avaliar a execução
    Então o guard deve lançar ForbiddenException com status 403

  Cenário: Administrador possui bypass no TenantScopeGuard
    Dado que a rota possui @TenantScoped({ checkUbs: true })
    E a requisição aponta para a UBS "ubs-de-outro-municipio"
    E o usuário autenticado possui o perfil "ADMINISTRADOR"
    Quando o TenantScopeGuard avaliar a execução
    Então o acesso deve ser autorizado com sucesso

  Cenário: Farmacêutico acessando UBS vinculada no seu município
    Dado que o Farmacêutico pertence ao município "Santos"
    E possui as UBSs ["ubs-01", "ubs-02"] vinculadas
    E a requisição acessa a rota com o parâmetro unidadeId "ubs-01"
    Quando o TenantScopeGuard avaliar a execução
    Então a requisição é autorizada
    E o req.tenantScope deve ser preenchido com município "Santos" e unidades autorizadas

  Cenário: Farmacêutico tentando acessar UBS de outro município ou não vinculada
    Dado que o Farmacêutico possui apenas a UBS "ubs-01" vinculada
    Quando ele tentar enviar requisição para a rota com parâmetro unidadeId "ubs-99"
    Então o TenantScopeGuard deve lançar ForbiddenException com status 403

  Cenário: Farmacêutico Residente tenta acessar endpoint exclusivo de Gerente (E2E)
    Dado uma requisição GET para "/api/v1/relatorios/indicadores"
    E o header Authorization contém token válido de "FARMACEUTICO_RESIDENTE"
    Quando a API processar a requisição
    Então o status HTTP de resposta deve ser 403 Forbidden

