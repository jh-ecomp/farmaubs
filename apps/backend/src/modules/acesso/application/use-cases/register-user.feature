# language: pt
Funcionalidade: Cadastro de Usuário no Módulo de Acesso

  Como Administrador do FarmaUBS
  Quero cadastrar novos usuários associando cada um a um perfil de acesso e a uma ou mais UBSs
  Com a senha armazenada como hash bcrypt (custo mínimo 12)
  Para que o acesso ao sistema seja concedido de forma controlada, com segurança e vínculo correto de escopo

  Contexto:
    Dado que os repositórios e serviços de apoio estão operacionais

  Cenário: Cadastro de usuário com sucesso com hash bcrypt custo 12 e envio de e-mail
    Dado que o repositório de usuários não possui o e-mail "ana.souza@farmaubs.local"
    E que o perfil "Farmacêutico Responsável" existe e está ativo no catálogo
    E que as UBSs informadas existem no sistema
    Quando eu submeto o comando de cadastro com os seguintes dados:
      | campo        | valor                                |
      | municipioId  | 11111111-1111-1111-1111-111111111111 |
      | nomeCompleto | Ana Souza                            |
      | email        | ana.souza@farmaubs.local             |
      | senha        | SenhaForte@2026                      |
      | perfil       | Farmacêutico Responsável             |
      | ubsIds       | 22222222-2222-2222-2222-222222222222 |
    Então o usuário deve ser salvo com status ativo e troca de senha obrigatória
    E a senha deve ser transformada em hash bcrypt com custo mínimo 12
    E a senha em texto puro não deve ser retornada nem persistida
    E o e-mail de confirmação de cadastro deve ser enviado para "ana.souza@farmaubs.local"

  Cenário: Localização do perfil de acesso por identificador UUID direto
    Dado que o perfil com ID "33333333-3333-3333-3333-333333333333" existe e está ativo
    Quando eu submeto o comando de cadastro informando o ID do perfil "33333333-3333-3333-3333-333333333333"
    Então o usuário deve ser vinculado ao perfil com ID "33333333-3333-3333-3333-333333333333"

  Cenário: Resiliência do cadastro caso o serviço de envio de e-mail falhe
    Dado que o serviço de e-mail está indisponível ou falha
    Quando eu submeto um comando de cadastro válido
    Então o usuário deve ser cadastrado com sucesso sem que a falha de e-mail interrompa o fluxo

  Cenário: Rejeição de cadastro quando o e-mail já existe
    Dado que já existe um usuário cadastrado com o e-mail "ana.souza@farmaubs.local"
    Quando eu submeto um comando de cadastro com o e-mail "ana.souza@farmaubs.local"
    Então o cadastro deve ser rejeitado com erro indicando que o e-mail já existe
    E o usuário não deve ser persistido
    E a senha não deve ter hash gerado
    E nenhum e-mail de confirmação deve ser enviado

  Cenário: Rejeição de cadastro com e-mail duplicado em caixa alta ou mista (normalização AC-03)
    Dado que já existe um usuário cadastrado com o e-mail "ana.souza@farmaubs.local"
    Quando eu submeto um comando de cadastro com o e-mail "ANA.SOUZA@FARMAUBS.LOCAL"
    Então a unicidade deve ser validada após normalização em caixa baixa
    E o cadastro deve ser rejeitado com erro indicando que o e-mail já existe

  Cenário: Rejeição de cadastro quando o perfil não for encontrado no catálogo
    Dado que o perfil "Perfil Inexistente" não existe no catálogo
    Quando eu submeto um comando de cadastro informando o perfil "Perfil Inexistente"
    Então o cadastro deve ser rejeitado com erro de perfil não encontrado
    E o usuário não deve ser persistido

  Cenário: Rejeição de cadastro quando o perfil existe mas está inativo
    Dado que o perfil "Farmacêutico Desativado" existe mas está inativo
    Quando eu submeto um comando de cadastro informando o perfil "Farmacêutico Desativado"
    Então o cadastro deve ser rejeitado com erro de perfil não encontrado ou inativo
    E o usuário não deve ser persistido

  Esquema do Cenário: Rejeição por campos obrigatórios ausentes ou inválidos
    Quando eu submeto um comando com dados inválidos contendo "<campo>" igual a "<valor>"
    Então o cadastro deve ser rejeitado com erro de validação de dados

    Exemplos:
      | campo        | valor                 |
      | comando      | nulo                  |
      | nomeCompleto | espacos               |
      | email        | vazio                 |
      | email        | formato-invalido      |
      | senha        | vazia                 |
      | senha        | curta                 |
      | perfil       | vazio                 |
      | ubsIds       | vazia                 |
      | municipioId  | vazio                 |

  Cenário: Rejeição quando uma das UBSs informadas não existe no sistema
    Dado que uma das UBSs informadas não existe no sistema
    Quando eu submeto um comando de cadastro com uma UBS inexistente
    Então o cadastro deve ser rejeitado com erro de unidade de saúde inválida

  Cenário: Deduplicação de IDs de UBS duplicadas na mesma requisição
    Quando eu submeto o comando de cadastro informando IDs de UBS duplicados
    Então as UBSs associadas ao usuário salvo devem ser deduplicadas

