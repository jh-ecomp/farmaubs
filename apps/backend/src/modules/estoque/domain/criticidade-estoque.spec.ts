import {
  calcularConsumoMedioDiario,
  calcularCoberturaDias,
  classificarValidadeLote,
  verificarRiscoRuptura,
} from "@farmaubs/shared";

describe("classificarValidadeLote", () => {
  const hoje = "2026-10-13";

  it.each([
    [
      "2026-10-12",
      { vencido: true, vencendoMesCorrente: false, validadeCurta90d: false },
    ],
    [
      "2026-10-13",
      { vencido: false, vencendoMesCorrente: true, validadeCurta90d: true },
    ],
    [
      "2026-10-31",
      { vencido: false, vencendoMesCorrente: true, validadeCurta90d: true },
    ],
    [
      "2026-11-01",
      { vencido: false, vencendoMesCorrente: false, validadeCurta90d: true },
    ],
    [
      "2027-01-11",
      { vencido: false, vencendoMesCorrente: false, validadeCurta90d: true },
    ],
    [
      "2027-01-12",
      { vencido: false, vencendoMesCorrente: false, validadeCurta90d: false },
    ],
  ])("validade %s", (validade, esperado) => {
    expect(classificarValidadeLote(validade, hoje)).toEqual(esperado);
  });

  it("não confunde mesmo mês de anos diferentes", () => {
    expect(
      classificarValidadeLote("2027-10-20", hoje).vencendoMesCorrente,
    ).toBe(false);
  });

  it("trata a virada de ano", () => {
    expect(
      classificarValidadeLote("2026-12-31", "2026-12-31").vencendoMesCorrente,
    ).toBe(true);
    const r = classificarValidadeLote("2027-01-01", "2026-12-31");
    expect(r.vencendoMesCorrente).toBe(false);
    expect(r.validadeCurta90d).toBe(true);
  });

  it("trata ano bissexto", () => {
    expect(
      classificarValidadeLote("2028-02-29", "2028-02-28").vencendoMesCorrente,
    ).toBe(true);
    expect(() => classificarValidadeLote("2027-02-29", "2027-02-28")).toThrow(
      RangeError,
    );
  });

  it.each(["13/10/2026", "2026-13-01", "2026-10-32", ""])(
    "rejeita data inválida %p",
    (valor) => {
      expect(() => classificarValidadeLote(valor, hoje)).toThrow(RangeError);
      expect(() => classificarValidadeLote(hoje, valor)).toThrow(RangeError);
    },
  );
});

describe("calcularConsumoMedioDiario", () => {
  it("divide o total pelos dias apurados", () => {
    expect(calcularConsumoMedioDiario(90, 30)).toBe(3);
  });
  it("aceita total zero", () => {
    expect(calcularConsumoMedioDiario(0, 30)).toBe(0);
  });
  it.each([0, -1, NaN])("rejeita diasApurados %p", (dias) => {
    expect(() => calcularConsumoMedioDiario(10, dias)).toThrow(RangeError);
  });
  it("rejeita total negativo", () => {
    expect(() => calcularConsumoMedioDiario(-1, 30)).toThrow(RangeError);
  });
});

describe("calcularCoberturaDias", () => {
  it("calcula saldo / CMD", () => {
    expect(calcularCoberturaDias(60, 3)).toBe(20);
  });
  it("retorna null com CMD zero", () => {
    expect(calcularCoberturaDias(60, 0)).toBeNull();
  });
  it("rejeita saldo negativo", () => {
    expect(() => calcularCoberturaDias(-1, 3)).toThrow(RangeError);
  });
});

describe("verificarRiscoRuptura", () => {
  it("risco no limite exato (20 dias)", () => {
    expect(
      verificarRiscoRuptura({ saldoAtual: 60, consumoMedioDiario: 3 }),
    ).toBe(true);
  });
  it("sem risco logo acima do limite", () => {
    expect(
      verificarRiscoRuptura({ saldoAtual: 61, consumoMedioDiario: 3 }),
    ).toBe(false);
  });
  it("saldo zero é sempre risco", () => {
    expect(
      verificarRiscoRuptura({ saldoAtual: 0, consumoMedioDiario: 0 }),
    ).toBe(true);
  });
  it("CMD zero com saldo positivo não é risco", () => {
    expect(
      verificarRiscoRuptura({ saldoAtual: 10, consumoMedioDiario: 0 }),
    ).toBe(false);
  });
  it("respeita prazo e margem customizados", () => {
    const base = { saldoAtual: 60, consumoMedioDiario: 3 };
    expect(
      verificarRiscoRuptura({
        ...base,
        tempoEntregaCafDias: 10,
        margemSegurancaDias: 5,
      }),
    ).toBe(false);
    expect(
      verificarRiscoRuptura({
        ...base,
        tempoEntregaCafDias: 20,
        margemSegurancaDias: 5,
      }),
    ).toBe(true);
  });
});
