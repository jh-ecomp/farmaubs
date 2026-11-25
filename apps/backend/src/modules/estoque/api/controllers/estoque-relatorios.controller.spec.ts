import {
  BadRequestException,
  NotFoundException,
  StreamableFile,
} from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import type { Response } from "express";
import { PerfilCodigo, type AuthenticatedUserPayload } from "@farmaubs/shared";
import { EstoqueRelatoriosController } from "./estoque-relatorios.controller";
import { GerarRelatorioEstoqueXlsxUseCase } from "../../application/use-cases/gerar-relatorio-estoque-xlsx.use-case";
import {
  IntervaloDatasRelatorioInvalidoException,
  UbsNaoEncontradaRelatorioException,
} from "../../domain/errors/estoque-relatorios.errors";

describe("EstoqueRelatoriosController", () => {
  let controller: EstoqueRelatoriosController;
  let mockUseCase: { execute: jest.Mock };

  beforeEach(async () => {
    mockUseCase = {
      execute: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [EstoqueRelatoriosController],
      providers: [
        {
          provide: GerarRelatorioEstoqueXlsxUseCase,
          useValue: mockUseCase,
        },
      ],
    }).compile();

    controller = module.get<EstoqueRelatoriosController>(
      EstoqueRelatoriosController,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("deve exportar XLSX com headers adequados e enviar o buffer no response", async () => {
    const fakeBuffer = Buffer.from("conteudo-planilha-excel");
    mockUseCase.execute.mockResolvedValueOnce({
      buffer: fakeBuffer,
      nomeArquivo: "relatorio-saldos-atuais_2026-11-24.xlsx",
      contentType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    const setMock = jest.fn();
    const resMock = { set: setMock } as unknown as Response;

    const user: AuthenticatedUserPayload = {
      id: "user-1",
      email: "user@farmaubs.gov.br",
      nomeCompleto: "Farmaceutico Responsavel Teste",
      perfilCodigo: PerfilCodigo.FARMACEUTICO_RESPONSAVEL,
      municipioId: "22222222-2222-2222-2222-222222222222",
      unidadeIds: ["11111111-1111-1111-1111-111111111111"],
      deveTrocarSenha: false,
    };

    const resultado = await controller.exportarXlsx(
      {
        tipoRelatorio: "SALDOS_ATUAIS",
        unidadeId: "11111111-1111-1111-1111-111111111111",
      },
      user,
      resMock,
    );

    expect(setMock).toHaveBeenCalledWith({
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition":
        'attachment; filename="relatorio-saldos-atuais_2026-11-24.xlsx"',
      "Content-Length": String(fakeBuffer.length),
    });
    expect(resultado).toBeInstanceOf(StreamableFile);
  });

  it("deve traduzir IntervaloDatasRelatorioInvalidoException para BadRequestException (400)", async () => {
    mockUseCase.execute.mockRejectedValueOnce(
      new IntervaloDatasRelatorioInvalidoException("Intervalo inválido"),
    );

    const resMock = {
      setHeader: jest.fn(),
      end: jest.fn(),
    } as unknown as Response;

    const user: AuthenticatedUserPayload = {
      id: "user-1",
      email: "user@farmaubs.gov.br",
      nomeCompleto: "Farmaceutico Responsavel Teste",
      perfilCodigo: PerfilCodigo.FARMACEUTICO_RESPONSAVEL,
      municipioId: "22222222-2222-2222-2222-222222222222",
      unidadeIds: ["11111111-1111-1111-1111-111111111111"],
      deveTrocarSenha: false,
    };

    await expect(
      controller.exportarXlsx(
        {
          tipoRelatorio: "MOVIMENTACOES_PERIODO",
          unidadeId: "11111111-1111-1111-1111-111111111111",
          dataInicio: "2026-11-20",
          dataFim: "2026-11-10",
        },
        user,
        resMock,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it("deve traduzir UbsNaoEncontradaRelatorioException para NotFoundException (404)", async () => {
    mockUseCase.execute.mockRejectedValueOnce(
      new UbsNaoEncontradaRelatorioException("11111111-1111-1111-1111-111111111111"),
    );

    const resMock = {
      setHeader: jest.fn(),
      end: jest.fn(),
    } as unknown as Response;

    const user: AuthenticatedUserPayload = {
      id: "user-1",
      email: "user@farmaubs.gov.br",
      nomeCompleto: "Administrador Teste",
      perfilCodigo: PerfilCodigo.ADMINISTRADOR,
      municipioId: "22222222-2222-2222-2222-222222222222",
      unidadeIds: [],
      deveTrocarSenha: false,
    };

    await expect(
      controller.exportarXlsx(
        {
          tipoRelatorio: "SALDOS_ATUAIS",
          unidadeId: "11111111-1111-1111-1111-111111111111",
        },
        user,
        resMock,
      ),
    ).rejects.toThrow(NotFoundException);
  });
});
