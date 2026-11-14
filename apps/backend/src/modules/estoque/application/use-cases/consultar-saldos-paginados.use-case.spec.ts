import type {
  FiltrosConsultaSaldos,
  LoteSaldoAgregado,
  ProdutoSaldoAgregado,
  RepositorioEstoqueSaldosPort,
} from "../../domain/ports/estoque-saldos.repository.port";
import { ConsultarSaldosPaginadosUseCase } from "./consultar-saldos-paginados.use-case";

const HOJE = "2026-11-01";
const UBS_ID = "11111111-1111-4111-8111-111111111111";

const filtros = (
  parcial: Partial<FiltrosConsultaSaldos> = {},
): FiltrosConsultaSaldos => ({
  filtroValidade: "TODOS",
  statusEstoque: "TODOS",
  pagina: 1,
  itensPorPagina: 10,
  ...parcial,
});

const lote = (parcial: Partial<LoteSaldoAgregado> = {}): LoteSaldoAgregado => ({
  id: "l1",
  numeroLote: "L001",
  fabricanteId: "f1",
  fabricanteNome: "Lab Teste",
  dataValidade: "2027-06-30",
  saldoAtual: 10,
  ...parcial,
});

const produto = (
  parcial: Partial<ProdutoSaldoAgregado> = {},
): ProdutoSaldoAgregado => ({
  produtoId: "p1",
  nome: "Dipirona",
  principioAtivo: "dipirona",
  formaFarmaceutica: "Comprimido",
  concentracao: "500 mg",
  unidadeMedida: "cp",
  categoria: "GERAL",
  saldoTotal: 100,
  totalDispensado: 0,
  diasApurados: 90,
  lotes: [],
  ...parcial,
});

function criar(itens: ProdutoSaldoAgregado[], total = itens.length) {
  const consultarSaldosPaginados = jest
    .fn()
    .mockResolvedValue({ itens, total });
  const useCase = new ConsultarSaldosPaginadosUseCase({
    consultarSaldosPaginados,
  } as RepositorioEstoqueSaldosPort);
  return { useCase, consultarSaldosPaginados };
}

describe("ConsultarSaldosPaginadosUseCase", () => {
  it("repassa ubsId, filtros e data de referência à porta", async () => {
    const { useCase, consultarSaldosPaginados } = criar([]);
    const f = filtros({ termo: "dipirona", pagina: 2 });

    await useCase.executar(UBS_ID, f, HOJE);

    expect(consultarSaldosPaginados).toHaveBeenCalledWith(UBS_ID, f, HOJE);
  });

  it("ordena os lotes por validade (FEFO) e classifica cada um", async () => {
    const { useCase } = criar([
      produto({
        saldoTotal: 50,
        lotes: [
          lote({ id: "a", numeroLote: "A", dataValidade: "2027-06-30" }),
          lote({ id: "b", numeroLote: "B", dataValidade: "2026-10-31" }),
          lote({ id: "c", numeroLote: "C", dataValidade: "2026-11-15" }),
          lote({ id: "d", numeroLote: "D", dataValidade: "2026-12-20" }),
        ],
      }),
    ]);

    const r = await useCase.executar(UBS_ID, filtros(), HOJE);

    expect(r.itens[0].lotes.map((l) => [l.numeroLote, l.statusValidade])).toEqual(
      [
        ["B", "VENCIDO"],
        ["C", "MES_CORRENTE"],
        ["D", "CURTA_90D"],
        ["A", "REGULAR"],
      ],
    );
  });

  it("calcula o statusEstoque do medicamento", async () => {
    const { useCase } = criar([
      produto({ produtoId: "zerado", saldoTotal: 0, totalDispensado: 50 }),
      // consumo médio de 13/dia: 260 un. = exatamente 20 dias de cobertura
      produto({ produtoId: "limite", saldoTotal: 260, totalDispensado: 1170 }),
      produto({ produtoId: "folga", saldoTotal: 261, totalDispensado: 1170 }),
      produto({ produtoId: "sem-consumo", saldoTotal: 100, totalDispensado: 0 }),
    ]);

    const r = await useCase.executar(UBS_ID, filtros(), HOJE);

    expect(r.itens.map((i) => [i.produtoId, i.statusEstoque])).toEqual([
      ["zerado", "ZERADO"],
      ["limite", "BAIXO_ESTOQUE"],
      ["folga", "REGULAR"],
      ["sem-consumo", "REGULAR"],
    ]);
  });

  it("monta os metadados de paginação (totalPaginas arredonda para cima)", async () => {
    const { useCase } = criar([produto()], 23);

    const r = await useCase.executar(
      UBS_ID,
      filtros({ pagina: 3, itensPorPagina: 10 }),
      HOJE,
    );

    expect(r).toMatchObject({
      total: 23,
      pagina: 3,
      itensPorPagina: 10,
      totalPaginas: 3,
    });
  });

  it("sem resultados retorna lista vazia e zero páginas", async () => {
    const { useCase } = criar([], 0);

    const r = await useCase.executar(UBS_ID, filtros(), HOJE);

    expect(r).toEqual({
      itens: [],
      total: 0,
      pagina: 1,
      itensPorPagina: 10,
      totalPaginas: 0,
    });
  });

  it("mantém nome, concentração e unidade de medida do medicamento", async () => {
    const { useCase } = criar([produto()]);

    const r = await useCase.executar(UBS_ID, filtros(), HOJE);

    expect(r.itens[0]).toMatchObject({
      nome: "Dipirona",
      concentracao: "500 mg",
      unidadeMedida: "cp",
      categoria: "GERAL",
    });
  });
});
