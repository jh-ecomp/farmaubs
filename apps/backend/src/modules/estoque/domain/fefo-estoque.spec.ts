import {
  calcularStatusEstoque,
  calcularStatusValidade,
  ordenarLotesSaldoPorFEFO,
} from "@farmaubs/shared";

const HOJE = "2026-11-01";

describe("calcularStatusValidade", () => {
  it.each([
    ["2026-10-31", "VENCIDO"], // ontem
    ["2026-11-01", "MES_CORRENTE"], // hoje
    ["2026-11-30", "MES_CORRENTE"], // fim do mês
    ["2026-12-01", "CURTA_90D"], // mês seguinte
    ["2027-01-30", "CURTA_90D"], // dia 90
    ["2027-01-31", "REGULAR"], // dia 91
  ])("validade %s => %s", (validade, esperado) => {
    expect(calcularStatusValidade(validade, HOJE)).toBe(esperado);
  });
});

describe("ordenarLotesSaldoPorFEFO", () => {
  it("ordena por validade e desempata pelo número do lote, sem mutar a entrada", () => {
    const entrada = [
      { numeroLote: "B", dataValidade: "2027-01-01" },
      { numeroLote: "C", dataValidade: "2026-12-01" },
      { numeroLote: "A", dataValidade: "2026-12-01" },
    ];
    const saida = ordenarLotesSaldoPorFEFO(entrada);
    expect(saida.map((l) => l.numeroLote)).toEqual(["A", "C", "B"]);
    expect(entrada[0].numeroLote).toBe("B");
  });
});

describe("calcularStatusEstoque", () => {
  it("saldo 0 é ZERADO", () => {
    expect(calcularStatusEstoque(0, 5)).toBe("ZERADO");
  });
  it("cobertura exatamente no limite de 20 dias é BAIXO_ESTOQUE", () => {
    expect(calcularStatusEstoque(260, 13)).toBe("BAIXO_ESTOQUE");
  });
  it("cobertura acima do limite é REGULAR", () => {
    expect(calcularStatusEstoque(261, 13)).toBe("REGULAR");
  });
  it("sem consumo e com saldo é REGULAR", () => {
    expect(calcularStatusEstoque(100, 0)).toBe("REGULAR");
  });
});
