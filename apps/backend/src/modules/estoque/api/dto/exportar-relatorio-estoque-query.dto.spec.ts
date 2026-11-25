import { validate } from "class-validator";
import { ForbiddenException } from "@nestjs/common";
import { PerfilCodigo, type AuthenticatedUserPayload } from "@farmaubs/shared";
import {
  ExportarRelatorioEstoqueQueryDto,
  validarEObterUbsIdRelatorio,
} from "./exportar-relatorio-estoque-query.dto";

describe("ExportarRelatorioEstoqueQueryDto", () => {
  it("valida com sucesso para tipoRelatorio permitido e datas opcionais válidas", async () => {
    const dto = new ExportarRelatorioEstoqueQueryDto();
    dto.tipoRelatorio = "SALDOS_ATUAIS";
    dto.dataInicio = "2026-10-01";
    dto.dataFim = "2026-10-31";
    dto.principioAtivo = "Amoxicilina";
    dto.unidadeId = "11111111-1111-4111-8111-111111111111";

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it("rejeita tipoRelatorio não permitido via @IsIn", async () => {
    const dto = new ExportarRelatorioEstoqueQueryDto();
    (dto as unknown as { tipoRelatorio: string }).tipoRelatorio =
      "RELATORIO_INVALIDO";

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    const tipoError = errors.find((e) => e.property === "tipoRelatorio");
    expect(tipoError?.constraints?.isIn).toBeDefined();
  });

  it("rejeita dataInicio ou dataFim com formato de data inválido", async () => {
    const dto = new ExportarRelatorioEstoqueQueryDto();
    dto.tipoRelatorio = "PERDAS_VENCIMENTO";
    dto.dataInicio = "data-invalida";

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    const dataError = errors.find((e) => e.property === "dataInicio");
    expect(dataError?.constraints?.matches).toBeDefined();
  });
  it("rejeita data em ISO completo (com horário), aceitando só YYYY-MM-DD", async () => {
    const dto = new ExportarRelatorioEstoqueQueryDto();
    dto.tipoRelatorio = "PERDAS_VENCIMENTO";
    dto.dataFim = "2026-10-01T10:00:00Z";

    const errors = await validate(dto);
    const dataError = errors.find((e) => e.property === "dataFim");
    expect(dataError?.constraints?.matches).toBeDefined();
  });
});

describe("validarEObterUbsIdRelatorio", () => {
  const userPadrao: AuthenticatedUserPayload = {
    id: "usr-1",
    email: "farmaceutico@ubs.gov.br",
    nomeCompleto: "Farmacêutico Responsável",
    perfilCodigo: PerfilCodigo.FARMACEUTICO_RESPONSAVEL,
    municipioId: "mun-1",
    unidadeIds: ["ubs-1", "ubs-2"],
    deveTrocarSenha: false,
  };

  it("retorna unidadeId da query se pertencer à sessão do usuário", () => {
    const ubs = validarEObterUbsIdRelatorio(userPadrao, "ubs-2");
    expect(ubs).toBe("ubs-2");
  });

  it("rejeita com ForbiddenException (403) se unidadeId da query não estiver na sessão", () => {
    expect(() =>
      validarEObterUbsIdRelatorio(userPadrao, "ubs-estranha"),
    ).toThrow(ForbiddenException);
  });

  it("permite qualquer unidadeId se o usuário for ADMINISTRADOR", () => {
    const adminUser: AuthenticatedUserPayload = {
      ...userPadrao,
      perfilCodigo: PerfilCodigo.ADMINISTRADOR,
    };
    const ubs = validarEObterUbsIdRelatorio(adminUser, "ubs-qualquer");
    expect(ubs).toBe("ubs-qualquer");
  });

  it("retorna a primeira unidade da sessão se unidadeId for omitido", () => {
    const ubs = validarEObterUbsIdRelatorio(userPadrao, undefined);
    expect(ubs).toBe("ubs-1");
  });

  it("lança ForbiddenException (403) se usuário não tiver nenhuma unidade atribuída", () => {
    const userSemUnidades: AuthenticatedUserPayload = {
      ...userPadrao,
      unidadeIds: [],
    };
    expect(() =>
      validarEObterUbsIdRelatorio(userSemUnidades, undefined),
    ).toThrow(ForbiddenException);
  });
});
