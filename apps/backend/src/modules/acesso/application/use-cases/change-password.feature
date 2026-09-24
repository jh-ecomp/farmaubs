# language: pt
Funcionalidade: Redefinição e Troca Obrigatória de Senha (Camada A)

  Cenário: Farmacêutico troca a senha provisória por nova senha válida
    Dado que o usuário "Lucas Mendes" possui deve_trocar_senha como verdadeiro
    E está autenticado com sua sessão provisória
    Quando ele submeter a nova senha "NovaSenhaSegura@2026" com confirmação idêntica
    Então o hash da senha é atualizado no repositório
    E o campo deve_trocar_senha passa a ser falso
    E a data de senha_atualizada_em é registrada
    E o sistema retorna sucesso com a mensagem "Senha alterada com sucesso."

  Cenário: Tentativa de reutilizar a senha provisória como nova senha
    Dado que o usuário está autenticado com a senha provisória "Provisoria@2026"
    Quando ele tentar definir "Provisoria@2026" como sua nova senha
    Então o sistema deve lançar a exceção "NovaSenhaNaoPodeSerIgualProvisoriaException"
    E o campo deve_trocar_senha permanece verdadeiro

  Cenário: Senha com confirmação divergente
    Dado que o usuário tenta trocar a senha
    Quando ele informa "NovaSenha@2026" e confirmação "OutraSenha@2026"
    Então o sistema deve lançar erro de confirmação de senha divergente

  Cenário: Tentativa de cadastrar senha fraca
    Dado que o usuário tenta trocar a senha
    Quando ele informa a senha fraca "123456" com confirmação "123456"
    Então o sistema deve lançar a exceção de senha fraca
