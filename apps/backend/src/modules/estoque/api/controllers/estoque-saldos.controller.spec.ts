import { PerfilCodigo } from "@farmaubs/shared";
import { EstoqueSaldosController } from "./estoque-saldos.controller";
import { ConsultarSaldosPaginadosUseCase } from "../../application/use-cases/consultar-saldos-paginados.use-case";
import { ROLES_KEY } from "../../../../common/decorators/roles.decorator";
import { TENANT_SCOPED_KEY } from "../../../../common/decorators/tenant-scoped.decorator";

describe("EstoqueSaldosController", () => {
  const UBS_ID = "11111111-1111-4111-8111-111111111111";
  const resposta = {
    itens: [],
    total: 0,
    pagina: 1,
    itensPorPagina: 15,
    totalPaginas: 0,
  };
  let useCase: { executar: jest.Mock };
  let controller: EstoqueSaldosController;

  beforeEach(() => {
    useCase = { executar: jest.fn().mockResolvedValue(resposta) };
    controller = new EstoqueSaldosController(
      useCase as unknown as ConsultarSaldosPaginadosUseCase,
    );
  });

  afterEach(() => jest.useRealTimers());

  it("aplica os valores padrão e devolve o DTO do use case", async () => {
    const r = await controller.consultar({ unidadeId: UBS_ID });

    expect(r).toBe(resposta);
    expect(useCase.executar).toHaveBeenCalledWith(
      UBS_ID,
      {
        termo: undefined,
        categoria: undefined,
        filtroValidade: "TODOS",
        statusEstoque: "TODOS",
        pagina: 1,
        itensPorPagina: 15,
      },
      expect.any(String),
    );
  });

  it("repassa filtros e paginação informados", async () => {
    await controller.consultar({
      unidadeId: UBS_ID,
      termo: "dipirona",
      categoria: "ANALGESICO",
      filtroValidade: "MES_CORRENTE",
      statusEstoque: "BAIXO_ESTOQUE",
      pagina: 3,
      itensPorPagina: 20,
    });

    expect(useCase.executar).toHaveBeenCalledWith(
      UBS_ID,
      {
        termo: "dipirona",
        categoria: "ANALGESICO",
        filtroValidade: "MES_CORRENTE",
        statusEstoque: "BAIXO_ESTOQUE",
        pagina: 3,
        itensPorPagina: 20,
      },
      expect.any(String),
    );
  });

  it("remove espaços do termo e da categoria e descarta valores vazios", async () => {
    await controller.consultar({
      unidadeId: UBS_ID,
      termo: "  dipirona  ",
      categoria: "   ",
    });

    const filtros = useCase.executar.mock.calls[0][1];
    expect(filtros.termo).toBe("dipirona");
    expect(filtros.categoria).toBeUndefined();
  });

  it("converte pagina e itensPorPagina recebidos como texto", async () => {
    await controller.consultar({
      unidadeId: UBS_ID,
      pagina: "2" as unknown as number,
      itensPorPagina: "50" as unknown as number,
    });

    const filtros = useCase.executar.mock.calls[0][1];
    expect(filtros.pagina).toBe(2);
    expect(filtros.itensPorPagina).toBe(50);
  });

  it("calcula 'hoje' no fuso de Fortaleza, não em UTC", async () => {
    // 02:30 UTC de 14/10 ainda é 23:30 de 13/10 em Fortaleza (UTC-3)
    jest.useFakeTimers().setSystemTime(new Date("2026-10-14T02:30:00Z"));
    await controller.consultar({ unidadeId: UBS_ID });
    expect(useCase.executar.mock.calls[0][2]).toBe("2026-10-13");
  });

  it("exige UBS no escopo do usuário (checkUbs)", () => {
    const meta = Reflect.getMetadata(TENANT_SCOPED_KEY, controller.consultar);
    expect(meta).toEqual({ checkUbs: true });
  });

  describe("RBAC (NF009)", () => {
    const perfis = (): string[] =>
      Reflect.getMetadata(ROLES_KEY, controller.consultar);

    it("libera responsável, residente, gerente e administrador", () => {
      expect(perfis()).toEqual(
        expect.arrayContaining([
          PerfilCodigo.FARMACEUTICO_RESPONSAVEL,
          PerfilCodigo.FARMACEUTICO_RESIDENTE,
          PerfilCodigo.GERENTE,
          PerfilCodigo.ADMINISTRADOR,
        ]),
      );
    });

    it("restringe a exatamente esses quatro perfis", () => {
      expect(perfis()).toHaveLength(4);
    });
  });
});
