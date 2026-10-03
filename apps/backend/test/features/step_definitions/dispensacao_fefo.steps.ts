import { Given, When, Then, Before } from "@cucumber/cucumber";
import { expect } from "chai";

// ── Modelos de Domínio de Dispensação / FEFO ─────────────────────────────────

interface MedicamentoCatalogo {
  id: string;
  nome: string;
  principioAtivo: string;
}

interface LoteEstoque {
  id: string;
  numeroLote: string;
  dataValidade: string;
  saldo: number;
  sugeridoFefo?: boolean;
  vencido?: boolean;
}

// ── Lógica de Domínio Pura (Camada A / FEFO) ──────────────────────────────────

class CatalogoDispensacaoService {
  constructor(
    private medicamentos: MedicamentoCatalogo[] = [],
    private lotes: LoteEstoque[] = []
  ) {}

  buscarPorTermo(termo: string): MedicamentoCatalogo[] {
    const normalizado = termo.toLowerCase();
    return this.medicamentos.filter(
      (m) =>
        m.nome.toLowerCase().includes(normalizado) ||
        m.principioAtivo.toLowerCase().includes(normalizado)
    );
  }

  obterSugestaoFefo(dataReferencia: Date = new Date()): {
    loteSugerido: LoteEstoque | null;
    lotes: LoteEstoque[];
  } {
    const refStr = dataReferencia.toISOString().split("T")[0];

    const lotesProcessados = this.lotes.map((lote) => {
      const vencido = lote.dataValidade < refStr;
      return {
        ...lote,
        vencido,
        sugeridoFefo: false,
      };
    });

    // Ordenar lotes não-vencidos por data de validade ascendente (FEFO)
    const validos = lotesProcessados
      .filter((l) => !l.vencido && l.saldo > 0)
      .sort((a, b) => a.dataValidade.localeCompare(b.dataValidade));

    let loteSugerido: LoteEstoque | null = null;
    if (validos.length > 0) {
      validos[0].sugeridoFefo = true;
      loteSugerido = validos[0];
    }

    return {
      loteSugerido,
      lotes: lotesProcessados,
    };
  }
}

// ── Contexto do Cucumber ─────────────────────────────────────────────────────

Before(function (this: any) {
  this.medicamentos = [];
  this.lotes = [];
  this.resultadoBusca = [];
  this.resultadoFefo = null;
});

// ── Step Definitions ─────────────────────────────────────────────────────────

Given(
  "que existem os medicamentos {string} e {string} cadastrados",
  function (this: any, med1: string, med2: string) {
    this.medicamentos = [
      { id: "med-1", nome: med1, principioAtivo: med1.split(" ")[0] },
      { id: "med-2", nome: med2, principioAtivo: med2.split(" ")[0] },
    ];
  }
);

When(
  "o farmacêutico buscar pelo termo {string}",
  function (this: any, termo: string) {
    const service = new CatalogoDispensacaoService(this.medicamentos, this.lotes);
    this.resultadoBusca = service.buscarPorTermo(termo);
  }
);

Then(
  "o resultado deve conter exatamente {int} medicamento",
  function (this: any, quantidadeEsperada: number) {
    expect(this.resultadoBusca.length).to.equal(quantidadeEsperada);
  }
);

Then(
  "o nome retornado deve ser {string}",
  function (this: any, nomeEsperado: string) {
    expect(this.resultadoBusca[0].nome).to.equal(nomeEsperado);
  }
);

Given(
  "que a UBS possui o lote {string} com vencimento em {string} e saldo {int}",
  function (this: any, numeroLote: string, dataValidade: string, saldo: number) {
    this.lotes.push({
      id: `id-${numeroLote}`,
      numeroLote,
      dataValidade,
      saldo,
    });
  }
);

Given(
  "possui o lote {string} com vencimento em {string} e saldo {int}",
  function (this: any, numeroLote: string, dataValidade: string, saldo: number) {
    this.lotes.push({
      id: `id-${numeroLote}`,
      numeroLote,
      dataValidade,
      saldo,
    });
  }
);

When(
  "o caso de uso ObterSugestaoLotesFefo for executado para o medicamento",
  function (this: any) {
    const service = new CatalogoDispensacaoService(this.medicamentos, this.lotes);
    this.resultadoFefo = service.obterSugestaoFefo(new Date("2026-10-01"));
  }
);

Then(
  "o loteSugerido deve ser o {string}",
  function (this: any, loteEsperado: string) {
    expect(this.resultadoFefo.loteSugerido).to.not.be.null;
    expect(this.resultadoFefo.loteSugerido.numeroLote).to.equal(loteEsperado);
  }
);

Then(
  "o lote {string} deve ter sugeridoFefo marcado como verdadeiro",
  function (this: any, numeroLote: string) {
    const lote = this.resultadoFefo.lotes.find((l: LoteEstoque) => l.numeroLote === numeroLote);
    expect(lote).to.not.be.undefined;
    expect(lote.sugeridoFefo).to.be.true;
  }
);

Given(
  "que a UBS possui um lote com data de validade anterior à data de hoje",
  function (this: any) {
    this.lotes.push({
      id: "lote-expirado",
      numeroLote: "LOTE-VENCIDO",
      dataValidade: "2025-01-01", // validade passada
      saldo: 20,
    });
  }
);

When(
  "a consulta de lotes para dispensação for executada",
  function (this: any) {
    const service = new CatalogoDispensacaoService(this.medicamentos, this.lotes);
    this.resultadoFefo = service.obterSugestaoFefo(new Date("2026-10-01"));
  }
);

Then(
  "o lote vencido não deve ser sugerido para a dispensa",
  function (this: any) {
    if (this.resultadoFefo.loteSugerido) {
      expect(this.resultadoFefo.loteSugerido.numeroLote).to.not.equal("LOTE-VENCIDO");
    }
  }
);

Then("deve ter a flag vencido como verdadeira", function (this: any) {
  const loteVencido = this.resultadoFefo.lotes.find(
    (l: LoteEstoque) => l.numeroLote === "LOTE-VENCIDO"
  );
  expect(loteVencido).to.not.be.undefined;
  expect(loteVencido.vencido).to.be.true;
});
