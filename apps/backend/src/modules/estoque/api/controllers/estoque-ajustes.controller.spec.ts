import {
  BadRequestException,
  HttpStatus,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { HTTP_CODE_METADATA } from "@nestjs/common/constants";
import {
  PerfilCodigo,
  type AuthenticatedUserPayload,
  type RegistrarAjusteLoteInputDto,
} from "@farmaubs/shared";
import { EstoqueAjustesController } from "./estoque-ajustes.controller";
import { RegistrarAjusteEstoqueUseCase } from "../../application/use-cases/registrar-ajuste-estoque.use-case";
import {
  DadosAjusteInvalidosException,
  JustificativaInvalidaException,
  LoteNaoEncontradoException,
  MotivoIncompativelException,
  SaldoInsuficienteException,
} from "../../domain/errors/ajuste-estoque.errors";
import { ROLES_KEY } from "../../../../common/decorators/roles.decorator";
import type { RegistrarAjusteEstoqueDto } from "../dto/registrar-ajuste-estoque.dto";

describe("EstoqueAjustesController", () => {
  const LOTE_ID = "22222222-2222-4222-8222-222222222222";
  const UBS_ID = "11111111-1111-4111-8111-111111111111";
  const USER_ID = "33333333-3333-4333-8333-333333333333";
  const dto: RegistrarAjusteEstoqueDto = {
    tipoOperacao: "ENTRADA",
    quantidade: 10,
    motivo: "DEVOLUCAO_PACIENTE",
    justificativa: "Paciente devolveu 10 comprimidos lacrados",
  } satisfies RegistrarAjusteLoteInputDto;
  const user = {
    id: USER_ID,
    nomeCompleto: "Ana Souza",
    unidadeIds: [UBS_ID],
  } as unknown as AuthenticatedUserPayload;

  let useCase: { execute: jest.Mock };
  let controller: EstoqueAjustesController;

  beforeEach(() => {
    useCase = { execute: jest.fn() };
    controller = new EstoqueAjustesController(
      useCase as unknown as RegistrarAjusteEstoqueUseCase,
    );
  });

  it("repassa lote, corpo e contexto da sessão ao caso de uso e devolve o resultado", async () => {
    const resultado = { movimentacaoId: "m1" };
    useCase.execute.mockResolvedValue(resultado);

    const r = await controller.registrar(LOTE_ID, dto, user);

    expect(r).toBe(resultado);
    expect(useCase.execute).toHaveBeenCalledWith(LOTE_ID, dto, {
      usuarioId: USER_ID,
      usuarioNome: "Ana Souza",
      unidadeIds: [UBS_ID],
    });
  });

  it("mapeia SaldoInsuficiente para 422", async () => {
    useCase.execute.mockRejectedValue(new SaldoInsuficienteException());
    await expect(
      controller.registrar(LOTE_ID, dto, user),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it("mapeia LoteNaoEncontrado para 404", async () => {
    useCase.execute.mockRejectedValue(new LoteNaoEncontradoException(LOTE_ID));
    await expect(
      controller.registrar(LOTE_ID, dto, user),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it.each([
    ["DadosAjusteInvalidos", new DadosAjusteInvalidosException("x")],
    ["MotivoIncompativel", new MotivoIncompativelException("SAIDA", "OUTRO")],
    ["JustificativaInvalida", new JustificativaInvalidaException("x")],
  ])("mapeia %s para 400", async (_nome, erro) => {
    useCase.execute.mockRejectedValue(erro);
    await expect(
      controller.registrar(LOTE_ID, dto, user),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("repassa erros desconhecidos sem convertê-los", async () => {
    const erro = new Error("falha inesperada");
    useCase.execute.mockRejectedValue(erro);
    await expect(controller.registrar(LOTE_ID, dto, user)).rejects.toBe(erro);
  });

  it("restringe o endpoint aos farmacêuticos (NF009), sem ADMINISTRADOR", () => {
    const roles = Reflect.getMetadata(
      ROLES_KEY,
      EstoqueAjustesController.prototype.registrar,
    ) as string[];

    expect([...roles].sort()).toEqual(
      [
        PerfilCodigo.FARMACEUTICO_RESPONSAVEL,
        PerfilCodigo.FARMACEUTICO_RESIDENTE,
      ].sort(),
    );
    expect(roles).not.toContain(PerfilCodigo.ADMINISTRADOR);
    expect(roles).not.toContain(PerfilCodigo.GERENTE);
  });

  it("responde 201 em caso de sucesso", () => {
    expect(
      Reflect.getMetadata(
        HTTP_CODE_METADATA,
        EstoqueAjustesController.prototype.registrar,
      ),
    ).toBe(HttpStatus.CREATED);
  });
});
