import { defineFeature, loadFeature } from "jest-cucumber";
import * as path from "path";
import { CadastrarPacienteUseCase } from "./cadastrar-paciente.use-case";
import { ConsultarHistoricoPacienteUseCase } from "./consultar-historico-paciente.use-case";
import { BuscarPacientesUseCase } from "./buscar-pacientes.use-case";
import type {
  PacienteRepositoryPort,
  ItemHistoricoRegistro,
} from "../../domain/ports/paciente.repository.port";
import {
  CnsInvalidoException,
  CpfInvalidoException,
  DadosPacienteInvalidosException,
  PacienteJaCadastradoException,
  PacienteNaoEncontradoException,
} from "../../domain/errors/paciente.errors";
import type {
  CadastrarPacienteRequest,
  HistoricoPacienteResultado,
  PacienteDto,
} from "@farmaubs/shared";

const feature = loadFeature(
  path.resolve(__dirname, "paciente-dispensacao.feature"),
);

defineFeature(feature, (test) => {
  let cadastrarUseCase: CadastrarPacienteUseCase;
  let consultarHistoricoUseCase: ConsultarHistoricoUseCase;
  let buscarPacientesUseCase: BuscarPacientesUseCase;
  let pacienteRepoMock: jest.Mocked<PacienteRepositoryPort>;

  let dadosEntrada: CadastrarPacienteRequest;
  const municipioIdMock = "0194e43e-a6fb-7389-9a74-94c039755ef0";
  let pacienteSalvo: PacienteDto | null = null;
  let historicoResultado: HistoricoPacienteResultado | null = null;
  let erroCapturado: Error | null = null;

  beforeEach(() => {
    pacienteSalvo = null;
    historicoResultado = null;
    erroCapturado = null;

    pacienteRepoMock = {
      buscarPorId: jest.fn(),
      buscarPorCpfOuCns: jest.fn(),
      buscarPorTermo: jest.fn(),
      salvar: jest.fn(),
      buscarHistorico90Dias: jest.fn(),
    };

    cadastrarUseCase = new CadastrarPacienteUseCase(pacienteRepoMock);
    consultarHistoricoUseCase = new ConsultarHistoricoPacienteUseCase(
      pacienteRepoMock,
    );
    buscarPacientesUseCase = new BuscarPacientesUseCase(pacienteRepoMock);
  });

  test("Cadastro de paciente com sucesso com os 4 dados obrigatórios", ({
    given,
    when,
    then,
    and,
  }) => {
    given(
      /^que o farmacêutico informa CNS "(.*)", CPF "(.*)", nome "(.*)" e data de nascimento "(.*)"$/,
      (cns: string, cpf: string, nome: string, dataNasc: string) => {
        dadosEntrada = {
          cns,
          cpf,
          nomeCompleto: nome,
          dataNascimento: dataNasc,
        };
        pacienteRepoMock.buscarPorCpfOuCns.mockResolvedValue(null);
        pacienteRepoMock.salvar.mockImplementation(async (d) => ({
          id: "0194e43e-a6fb-7389-9a74-94c039755ef7",
          municipioId: d.municipioId,
          cns: d.cns,
          cpf: d.cpf,
          nomeCompleto: d.nomeCompleto,
          dataNascimento: d.dataNascimento,
          ativo: true,
          criadoEm: new Date(),
        }));
      },
    );

    when("o caso de uso CadastrarPacienteUseCase for executado", async () => {
      try {
        pacienteSalvo = await cadastrarUseCase.execute(
          dadosEntrada,
          municipioIdMock,
        );
      } catch (e) {
        erroCapturado = e as Error;
      }
    });

    then(
      "o paciente deve ser persistido com sucesso vinculado ao município da sessão",
      () => {
        expect(erroCapturado).toBeNull();
        expect(pacienteSalvo).toBeDefined();
        expect(pacienteSalvo?.municipioId).toBe(municipioIdMock);
        expect(pacienteRepoMock.salvar).toHaveBeenCalledWith(
          expect.objectContaining({
            municipioId: municipioIdMock,
            cns: "123456789012345",
            cpf: "12345678909",
            nomeCompleto: "Maria Souza",
            dataNascimento: "1985-04-12",
          }),
        );
      },
    );

    and("o identificador UUID deve ser retornado", () => {
      expect(pacienteSalvo?.id).toBe("0194e43e-a6fb-7389-9a74-94c039755ef7");
    });
  });

  test("Rejeição de cadastro com CPF inválido", ({
    given,
    when,
    then,
    and,
  }) => {
    given(
      "que o farmacêutico informa um CPF com dígitos verificadores matematicamente incorretos",
      () => {
        dadosEntrada = {
          cns: "123456789012345",
          cpf: "11122233344", // CPF com DV inválido
          nomeCompleto: "Carlos Lima",
          dataNascimento: "1990-01-01",
        };
      },
    );

    when("o caso de uso CadastrarPacienteUseCase for executado", async () => {
      try {
        pacienteSalvo = await cadastrarUseCase.execute(
          dadosEntrada,
          municipioIdMock,
        );
      } catch (e) {
        erroCapturado = e as Error;
      }
    });

    then("uma exceção CpfInvalidoException deve ser lançada", () => {
      expect(erroCapturado).toBeInstanceOf(CpfInvalidoException);
    });

    and("nenhum registro deve ser gravado no banco", () => {
      expect(pacienteRepoMock.salvar).not.toHaveBeenCalled();
    });
  });

  test("Alerta de dispensação antecipada no histórico de consumo", ({
    given,
    when,
    then,
    and,
  }) => {
    const dataReferencia = new Date("2026-10-18T12:00:00.000Z");
    const pacienteId = "0194e43e-a6fb-7389-9a74-94c039755ef5";

    given(
      /^que o paciente "(.*)" retirou "(.*)" há (\d+) dias$/,
      (nomePaciente: string, nomeMedicamento: string, diasAtrasStr: string) => {
        const diasAtras = parseInt(diasAtrasStr, 10);
        const dataRetirada = new Date(dataReferencia);
        dataRetirada.setDate(dataRetirada.getDate() - diasAtras);

        pacienteRepoMock.buscarPorId.mockResolvedValue({
          id: pacienteId,
          municipioId: municipioIdMock,
          cns: "123456789012345",
          cpf: "12345678909",
          nomeCompleto: nomePaciente,
          dataNascimento: "1980-05-10",
          ativo: true,
          criadoEm: new Date(),
        });

        const historicoMock: ItemHistoricoRegistro[] = [
          {
            dispensacaoId: "0194e43e-a6fb-7389-9a74-94c039755ef6",
            dataDispensacao: dataRetirada,
            medicamentoId: "0194e43e-a6fb-7389-9a74-94c039755ef2",
            medicamentoNome: nomeMedicamento,
            quantidadeDispensada: 30,
            posologia: "1 comp/dia",
          },
        ];

        pacienteRepoMock.buscarHistorico90Dias.mockResolvedValue(historicoMock);
      },
    );

    when(
      "o farmacêutico consultar o histórico de consumo do paciente",
      async () => {
        try {
          historicoResultado = await consultarHistoricoUseCase.execute(
            pacienteId,
            dataReferencia,
          );
        } catch (e) {
          erroCapturado = e as Error;
        }
      },
    );

    then(
      /^o item "(.*)" deve constar com diasDesdeUltimaRetirada igual a (\d+)$/,
      (nomeMedicamento: string, diasEsperadosStr: string) => {
        expect(erroCapturado).toBeNull();
        expect(historicoResultado).toBeDefined();
        const item = historicoResultado?.itensConsumo.find(
          (i) => i.medicamentoNome === nomeMedicamento,
        );
        expect(item).toBeDefined();
        expect(item?.diasDesdeUltimaRetirada).toBe(
          parseInt(diasEsperadosStr, 10),
        );
      },
    );

    and(
      "a flag possivelUsoIrracional deve ser retornada como verdadeira",
      () => {
        const item = historicoResultado?.itensConsumo[0];
        expect(item?.possivelUsoIrracional).toBe(true);
      },
    );
  });
});

describe("Casos de borda da Gestão de Pacientes (Camada A)", () => {
  let cadastrarUseCase: CadastrarPacienteUseCase;
  let consultarHistoricoUseCase: ConsultarHistoricoPacienteUseCase;
  let buscarPacientesUseCase: BuscarPacientesUseCase;
  let pacienteRepoMock: jest.Mocked<PacienteRepositoryPort>;

  const municipioIdMock = "0194e43e-a6fb-7389-9a74-94c039755ef0";

  beforeEach(() => {
    pacienteRepoMock = {
      buscarPorId: jest.fn(),
      buscarPorCpfOuCns: jest.fn(),
      buscarPorTermo: jest.fn(),
      salvar: jest.fn(),
      buscarHistorico90Dias: jest.fn(),
    };

    cadastrarUseCase = new CadastrarPacienteUseCase(pacienteRepoMock);
    consultarHistoricoUseCase = new ConsultarHistoricoPacienteUseCase(
      pacienteRepoMock,
    );
    buscarPacientesUseCase = new BuscarPacientesUseCase(pacienteRepoMock);
  });

  it("deve rejeitar CNS com menos de 15 dígitos ou dígitos repetidos", async () => {
    await expect(
      cadastrarUseCase.execute(
        {
          cns: "123",
          cpf: "12345678909",
          nomeCompleto: "Maria Souza",
          dataNascimento: "1985-04-12",
        },
        municipioIdMock,
      ),
    ).rejects.toBeInstanceOf(CnsInvalidoException);

    await expect(
      cadastrarUseCase.execute(
        {
          cns: "000000000000000",
          cpf: "12345678909",
          nomeCompleto: "Maria Souza",
          dataNascimento: "1985-04-12",
        },
        municipioIdMock,
      ),
    ).rejects.toBeInstanceOf(CnsInvalidoException);
  });

  it("deve rejeitar nome completo com menos de 3 caracteres ou caracteres de controle", async () => {
    await expect(
      cadastrarUseCase.execute(
        {
          cns: "123456789012345",
          cpf: "12345678909",
          nomeCompleto: "Jo",
          dataNascimento: "1985-04-12",
        },
        municipioIdMock,
      ),
    ).rejects.toBeInstanceOf(DadosPacienteInvalidosException);

    await expect(
      cadastrarUseCase.execute(
        {
          cns: "123456789012345",
          cpf: "12345678909",
          nomeCompleto: "Maria\x00Souza",
          dataNascimento: "1985-04-12",
        },
        municipioIdMock,
      ),
    ).rejects.toBeInstanceOf(DadosPacienteInvalidosException);
  });

  it("deve rejeitar data de nascimento no futuro ou com mais de 130 anos", async () => {
    const amanha = new Date();
    amanha.setDate(amanha.getDate() + 1);
    const dataFutura = amanha.toISOString().slice(0, 10);

    await expect(
      cadastrarUseCase.execute(
        {
          cns: "123456789012345",
          cpf: "12345678909",
          nomeCompleto: "Maria Souza",
          dataNascimento: dataFutura,
        },
        municipioIdMock,
      ),
    ).rejects.toBeInstanceOf(DadosPacienteInvalidosException);

    await expect(
      cadastrarUseCase.execute(
        {
          cns: "123456789012345",
          cpf: "12345678909",
          nomeCompleto: "Maria Souza",
          dataNascimento: "1850-01-01",
        },
        municipioIdMock,
      ),
    ).rejects.toBeInstanceOf(DadosPacienteInvalidosException);
  });

  it("deve rejeitar cadastro quando já existe paciente com mesmo CPF ou CNS no município", async () => {
    pacienteRepoMock.buscarPorCpfOuCns.mockResolvedValue({
      id: "0194e43e-a6fb-7389-9a74-94c039755ef7",
      municipioId: municipioIdMock,
      cns: "123456789012345",
      cpf: "12345678909",
      nomeCompleto: "Maria Souza Existente",
      dataNascimento: "1985-04-12",
      ativo: true,
      criadoEm: new Date(),
    });

    await expect(
      cadastrarUseCase.execute(
        {
          cns: "123456789012345",
          cpf: "12345678909",
          nomeCompleto: "Maria Souza Nova",
          dataNascimento: "1985-04-12",
        },
        municipioIdMock,
      ),
    ).rejects.toBeInstanceOf(PacienteJaCadastradoException);
  });

  it("deve retornar lista vazia na busca se termo estiver em branco", async () => {
    const res = await buscarPacientesUseCase.execute("");
    expect(res).toEqual([]);
    expect(pacienteRepoMock.buscarPorTermo).not.toHaveBeenCalled();
  });

  it("deve buscar pacientes delegando limite 10 para o repositório", async () => {
    pacienteRepoMock.buscarPorTermo.mockResolvedValue([]);
    await buscarPacientesUseCase.execute("Maria");
    expect(pacienteRepoMock.buscarPorTermo).toHaveBeenCalledWith("Maria", 10);
  });

  it("deve lançar PacienteNaoEncontradoException ao consultar histórico de paciente inexistente", async () => {
    pacienteRepoMock.buscarPorId.mockResolvedValue(null);
    await expect(
      consultarHistoricoUseCase.execute("0194e43e-a6fb-7389-9a74-94c039755ef9"),
    ).rejects.toBeInstanceOf(PacienteNaoEncontradoException);
  });

  it("não deve marcar possivelUsoIrracional se última retirada foi há 25 dias ou mais", async () => {
    const dataRef = new Date("2026-10-18T12:00:00.000Z");
    const dataRetirada = new Date("2026-09-20T12:00:00.000Z"); // 28 dias atrás

    pacienteRepoMock.buscarPorId.mockResolvedValue({
      id: "paciente-1",
      municipioId: municipioIdMock,
      cns: "123456789012345",
      cpf: "12345678909",
      nomeCompleto: "João Silva",
      dataNascimento: "1980-01-01",
      ativo: true,
      criadoEm: new Date(),
    });

    pacienteRepoMock.buscarHistorico90Dias.mockResolvedValue([
      {
        dispensacaoId: "disp-1",
        dataDispensacao: dataRetirada,
        medicamentoId: "med-1",
        medicamentoNome: "Losartana 50mg",
        quantidadeDispensada: 30,
      },
    ]);

    const res = await consultarHistoricoUseCase.execute("paciente-1", dataRef);
    expect(res.itensConsumo[0].diasDesdeUltimaRetirada).toBe(28);
    expect(res.itensConsumo[0].possivelUsoIrracional).toBe(false);
  });
});

