import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { RecebimentoController } from "./recebimento.controller";
import type { EfetivarRecebimentoUseCase } from "../../application/use-cases/efetivar-recebimento.use-case";
import { PerfilCodigo, TipoDocumentoEntradaEnum } from "@farmaubs/shared";

describe("RecebimentoController (RF008 / RF028)", () => {
  let controller: RecebimentoController;
  let fakeUseCase: jest.Mocked<EfetivarRecebimentoUseCase>;

  const usuarioMock = {
    id: "user-123",
    email: "farmaceutico@ubs.gov.br",
    nomeCompleto: "Dr. João Silva",
    perfilCodigo: PerfilCodigo.FARMACEUTICO_RESPONSAVEL,
    municipioId: "mun-123",
    unidadeIds: ["ubs-456"],
    deveTrocarSenha: false,
  };

  const payloadDto = {
    numeroDocumento: "NF-00123",
    tipoDocumento: TipoDocumentoEntradaEnum.GUIA_CAF,
    fornecedorOrigem: "CAF Central",
    itens: [
      {
        produtoId: "prod-1",
        fabricanteId: "fab-1",
        numeroLote: "LOT-X",
        dataValidade: "2027-12-31",
        quantidadeRecebida: 150,
      },
    ],
  };

  beforeEach(() => {
    fakeUseCase = {
      execute: jest.fn().mockResolvedValue({
        id: "doc-1",
        numeroDocumento: "NF-00123",
        tipoDocumento: "GUIA_CAF",
        fornecedorOrigem: "CAF Central",
        dataRecebimento: new Date(),
        usuarioRecebedorId: "user-123",
        itens: [],
        avisos: [],
      }),
    } as unknown as jest.Mocked<EfetivarRecebimentoUseCase>;

    controller = new RecebimentoController(fakeUseCase);
  });

  it("deve invocar o caso de uso usando a UBS padrão do usuário quando não informada no body", async () => {
    const resultado = await controller.efetivarEntrada(payloadDto, usuarioMock);

    expect(fakeUseCase.execute).toHaveBeenCalledWith(
      payloadDto,
      expect.objectContaining({
        municipioId: "mun-123",
        ubsId: "ubs-456",
        usuarioId: "user-123",
      }),
    );
    expect(resultado.numeroDocumento).toBe("NF-00123");
  });

  it("deve permitir informar ubsId explicitamente se estiver na lista autorizada do usuário", async () => {
    const usuarioMultiplasUbs = {
      ...usuarioMock,
      unidadeIds: ["ubs-456", "ubs-789"],
    };

    const dtoComUbs = { ...payloadDto, ubsId: "ubs-789" };
    await controller.efetivarEntrada(dtoComUbs, usuarioMultiplasUbs);

    expect(fakeUseCase.execute).toHaveBeenCalledWith(
      dtoComUbs,
      expect.objectContaining({
        ubsId: "ubs-789",
      }),
    );
  });

  it("deve lançar ForbiddenException se a UBS informada no body não pertencer ao usuário", async () => {
    await expect(
      controller.efetivarEntrada(
        { ...payloadDto, ubsId: "ubs-invasora" },
        usuarioMock,
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it("deve lançar BadRequestException se o usuário não possuir nenhuma UBS vinculada e não informar ubsId", async () => {
    const usuarioSemUbs = {
      ...usuarioMock,
      unidadeIds: [],
    };

    await expect(
      controller.efetivarEntrada(payloadDto, usuarioSemUbs),
    ).rejects.toThrow(BadRequestException);
  });
});
