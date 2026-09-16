# language: pt
Funcionalidade: Listagem Paginada de Usuários (RF001 / RF025)

  Cenário: Solicitação padrão de listagem paginada
    Dado que existem 25 usuários cadastrados no repositório
    Quando o caso de uso for executado sem parâmetros adicionais
    Então o resultado deve conter o total de 25 usuários
    E a página atual deve ser 1
    E o limite deve ser 10
    E o total de páginas deve ser 3
    E a lista retornada deve conter 10 usuários
    E nenhum usuário deve conter o campo "senha_hash"

  Cenário: Filtragem por município e status ativo
    Dado que existem usuários em "Parnaíba" e "Teresina"
    Quando o caso de uso for executado com município "11111111-1111-1111-1111-111111111111" e status "ATIVO"
    Então o repositório deve ser consultado com o filtro de município "11111111-1111-1111-1111-111111111111" e status "ATIVO"
    E todos os usuários retornados devem ser do município filtrado e estar ativos

  Cenário: Busca parcial textual por nome ou e-mail
    Dado que existe o usuário "Dra. Mariana Vasconcelos" com e-mail "mariana.vasconcelos@farmaubs.gov.br"
    Quando o caso de uso for executado com o termo de busca "mariana"
    Então o repositório deve ser consultado com o termo de busca "mariana"
    E o usuário "Dra. Mariana Vasconcelos" deve constar no resultado

  Cenário: Normalização de limites de paginação extremos
    Dado que o repositório possui usuários cadastrados
    Quando o caso de uso for executado com página menor que 1 e limite maior que 100
    Então o caso de uso deve normalizar a página para 1 e o limite para 100

