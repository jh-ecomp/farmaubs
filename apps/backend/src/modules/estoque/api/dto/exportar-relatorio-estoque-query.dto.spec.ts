import { validate } from "class-validator";
import { ExportarRelatorioEstoqueQueryDto } from "./exportar-relatorio-estoque-query.dto";

describe("ExportarRelatorioEstoqueQueryDto", () => {
  it("valida com sucesso para unidadeId, tipoRelatorio permitido e filtros opcionais válidos", async () => {
    const dto = new ExportarRelatorioEstoqueQueryDto();
    dto.unidadeId = "11111111-1111-4111-8111-111111111111";
    dto.tipoRelatorio = "SALDOS_ATUAIS";
    dto.dataInicio = "2026-10-01";
    dto.dataFim = "2026-10-31";
    dto.principioAtivo = "Amoxicilina";

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it("rejeita quando unidadeId está ausente ou não é UUID válido", async () => {
    const dtoSemUbs = new ExportarRelatorioEstoqueQueryDto();
    dtoSemUbs.tipoRelatorio = "SALDOS_ATUAIS";

    const errorsAusente = await validate(dtoSemUbs);
    expect(
      errorsAusente.find((e) => e.property === "unidadeId")?.constraints
        ?.isUuid,
    ).toBeDefined();

    const dtoInvalido = new ExportarRelatorioEstoqueQueryDto();
    dtoInvalido.unidadeId = "nao-e-uuid";
    dtoInvalido.tipoRelatorio = "SALDOS_ATUAIS";

    const errorsInvalido = await validate(dtoInvalido);
    expect(
      errorsInvalido.find((e) => e.property === "unidadeId")?.constraints
        ?.isUuid,
    ).toBeDefined();
  });

  it("rejeita tipoRelatorio não permitido via @IsIn", async () => {
    const dto = new ExportarRelatorioEstoqueQueryDto();
    dto.unidadeId = "11111111-1111-4111-8111-111111111111";
    (dto as unknown as { tipoRelatorio: string }).tipoRelatorio =
      "RELATORIO_INVALIDO";

    const errors = await validate(dto);
    const tipoError = errors.find((e) => e.property === "tipoRelatorio");
    expect(tipoError?.constraints?.isIn).toBeDefined();
  });

  it("rejeita dataInicio ou dataFim com formato de data inválido", async () => {
    const dto = new ExportarRelatorioEstoqueQueryDto();
    dto.unidadeId = "11111111-1111-4111-8111-111111111111";
    dto.tipoRelatorio = "PERDAS_VENCIMENTO";
    dto.dataInicio = "data-invalida";

    const errors = await validate(dto);
    const dataError = errors.find((e) => e.property === "dataInicio");
    expect(dataError?.constraints?.matches).toBeDefined();
  });

  it("rejeita data em ISO completo (com horário), aceitando só YYYY-MM-DD", async () => {
    const dto = new ExportarRelatorioEstoqueQueryDto();
    dto.unidadeId = "11111111-1111-4111-8111-111111111111";
    dto.tipoRelatorio = "PERDAS_VENCIMENTO";
    dto.dataFim = "2026-10-01T10:00:00Z";

    const errors = await validate(dto);
    const dataError = errors.find((e) => e.property === "dataFim");
    expect(dataError?.constraints?.matches).toBeDefined();
  });
});
