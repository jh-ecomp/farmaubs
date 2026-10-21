# language: pt
Funcionalidade: Gestão e Validação de Pacientes na Dispensação (Camada A)

  Cenário: Cadastro de paciente com sucesso com os 4 dados obrigatórios
    Dado que o farmacêutico informa CNS "123456789012345", CPF "12345678909", nome "Maria Souza" e data de nascimento "1985-04-12"
    Quando o caso de uso CadastrarPacienteUseCase for executado
    Então o paciente deve ser persistido com sucesso vinculado ao município da sessão
    E o identificador UUID deve ser retornado

  Cenário: Rejeição de cadastro com CPF inválido
    Dado que o farmacêutico informa um CPF com dígitos verificadores matematicamente incorretos
    Quando o caso de uso CadastrarPacienteUseCase for executado
    Então uma exceção CpfInvalidoException deve ser lançada
    E nenhum registro deve ser gravado no banco

  Cenário: Alerta de dispensação antecipada no histórico de consumo
    Dado que o paciente "João da Silva" retirou "Losartana 50mg" há 12 dias
    Quando o farmacêutico consultar o histórico de consumo do paciente
    Então o item "Losartana 50mg" deve constar com diasDesdeUltimaRetirada igual a 12
    E a flag possivelUsoIrracional deve ser retornada como verdadeira

