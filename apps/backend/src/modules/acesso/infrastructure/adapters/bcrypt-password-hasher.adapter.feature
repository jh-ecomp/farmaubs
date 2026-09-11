# language: pt
Funcionalidade: Adaptador de Hash de Senha Bcrypt (NF011)

  Como módulo de acesso do FarmaUBS
  Quero gerar e comparar hashes de senhas utilizando o algoritmo bcrypt com custo mínimo 12
  Para atender à especificação NF011 garantindo proteção das credenciais em repouso
  E mantendo o domínio estritamente isolado de bibliotecas criptográficas externas

  Contexto:
    Dado que o adaptador BcryptPasswordHasherAdapter está disponível

  Cenário: Geração de hash bcrypt com custo mínimo 12 (NF011)
    Dado que o adaptador é inicializado com a configuração padrão
    Quando eu solicito a geração do hash para a senha "SenhaForte@2026"
    Então o hash gerado deve ser uma string bcrypt válida
    E o fator de custo do hash deve ser de no mínimo 12
    E a senha em texto puro não deve estar exposta no hash gerado

  Cenário: Comparação bem-sucedida de senha correta com o hash
    Dado que uma senha "SenhaCorreta#123" teve seu hash gerado pelo adaptador
    Quando eu comparo a mesma senha "SenhaCorreta#123" com o hash gerado
    Então a verificação deve retornar verdadeiro

  Cenário: Rejeição na comparação com senha incorreta
    Dado que uma senha "SenhaOriginal#123" teve seu hash gerado pelo adaptador
    Quando eu comparo a senha incorreta "SenhaErrada#999" com o hash gerado
    Então a verificação deve retornar falso

  Cenário: Garantia do piso de custo 12 mesmo com configuração inferior (NF011)
    Dado que o serviço de configuração informa um BCRYPT_COST igual a "8"
    Quando o adaptador é inicializado com esse serviço de configuração
    Então o fator de custo efetivo do adaptador deve ser 12

  Cenário: Resiliência e retorno falso contra hash inválido ou corrompido
    Dado que o adaptador é inicializado com a configuração padrão
    Quando eu comparo uma senha qualquer com o hash inválido "hash_invalido_corrompido"
    Então a verificação deve retornar falso sem lançar exceção

