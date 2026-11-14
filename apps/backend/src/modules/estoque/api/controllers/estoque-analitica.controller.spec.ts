import { PerfilCodigo } from "@farmaubs/shared";
import { EstoqueAnaliticaController } from "./estoque-analitica.controller";
import { ObterMetricasEstoqueUseCase } from "../../application/use-cases/obter-metricas-estoque.use-case";
import { ROLES_KEY } from "../../../../common/decorators/roles.decorator";
import { TENANT_SCOPED_KEY } from "../../../../common/decorators/tenant-scoped.decorator";

describe("EstoqueAnaliticaController", () => {
  const resposta = {
    totalMedicamentosAtivos: 85,
    totalUnidadesFisicas: 12450,
    itensRiscoRuptura: 4,
    lotesValidadeMesAtual: 6,
    lotesValidadeCurta90d: 11,
    lotesVencidos: 0,
    calculadoEm: "2026-10-14T12:00:00.000Z",
  };
  let useCase: { executar: jest.Mock };
  let controller: EstoqueAnaliticaController;

  beforeEach(() => {
    useCase = { executar: jest.fn().mockResolvedValue(resposta) };
    controller = new EstoqueAnaliticaController(
      useCase as unknown as ObterMetricasEstoqueUseCase,
    );
  });

  afterEach(() => jest.useRealTimers());

  it("repassa a UBS informada e devolve o DTO do use case", async () => {
    const r = await controller.obter({ unidadeId: "ubs-1" });
    expect(r).toBe(resposta);
    expect(useCase.executar).toHaveBeenCalledWith("ubs-1", expect.any(String));
  });

  it("calcula 'hoje' no fuso de Fortaleza, não em UTC", async () => {
    // 02:30 UTC de 14/10 ainda é 23:30 de 13/10 em Fortaleza (UTC-3)
    jest.useFakeTimers().setSystemTime(new Date("2026-10-14T02:30:00Z"));
    await controller.obter({ unidadeId: "ubs-1" });
    expect(useCase.executar).toHaveBeenCalledWith("ubs-1", "2026-10-13");
  });

  it("exige UBS no escopo do usuário (checkUbs)", () => {
    const meta = Reflect.getMetadata(TENANT_SCOPED_KEY, controller.obter);
    expect(meta).toEqual({ checkUbs: true });
  });

  describe("RBAC (NF009)", () => {
    const perfis = (): string[] =>
      Reflect.getMetadata(ROLES_KEY, controller.obter);

    it("libera responsável, residente e gerente", () => {
      expect(perfis()).toEqual(
        expect.arrayContaining([
          PerfilCodigo.FARMACEUTICO_RESPONSAVEL,
          PerfilCodigo.FARMACEUTICO_RESIDENTE,
          PerfilCodigo.GERENTE,
        ]),
      );
    });

    it("libera o administrador (matrizes de RBAC ac-13 e ac-21)", () => {
      expect(perfis()).toContain(PerfilCodigo.ADMINISTRADOR);
    });

    it("restringe a exatamente esses quatro perfis", () => {
      expect(perfis()).toHaveLength(4);
    });
  });
});
