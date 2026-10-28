import { Before, Given, Then, When } from "@cucumber/cucumber";
import type { DataTable } from "@cucumber/cucumber";
import { expect } from "chai";
import type { EstoqueMetricasResponseDto } from "@farmaubs/shared";
import { ObterMetricasEstoqueUseCase } from "../../../src/modules/estoque/application/use-cases/obter-metricas-estoque.use-case";
import type {
  ConsumoProdutoAgregado,
  LoteValidadeAgregado,
  RepositorioEstoqueMetricasPort,
} from "../../../src/modules/estoque/domain/ports/estoque-metricas.repository.port";

interface DadosUbs {
  totalMedicamentosAtivos: number;
  totalUnidadesFisicas: number;
  consumo: ConsumoProdutoAgregado[];
  lotes: LoteValidadeAgregado[];
}

/** Repositório em memória que registra as UBSs consultadas. */
class RepositorioMetricasFake implements RepositorioEstoqueMetricasPort {
  readonly consultas: string[] = [];

  constructor(private readonly dados: Map<string, DadosUbs>) {}

  private dadosDa(ubsId: string): DadosUbs {
    this.consultas.push(ubsId);
    return (
      this.dados.get(ubsId) ?? {
        totalMedicamentosAtivos: 0,
        totalUnidadesFisicas: 0,
        consumo: [],
        lotes: [],
      }
    );
  }

  async obterTotais(ubsId: string) {
    const d = this.dadosDa(ubsId);
    return {
      totalMedicamentosAtivos: d.totalMedicamentosAtivos,
      totalUnidadesFisicas: d.totalUnidadesFisicas,
    };
  }

  async listarConsumoPorProduto(ubsId: string) {
    return this.dadosDa(ubsId).consumo;
  }

  async listarLotesParaValidade(ubsId: string) {
    return this.dadosDa(ubsId).lotes;
  }
}

const AGORA_FIXA = new Date("2026-10-13T16:00:00.000Z");

const CAMPOS: Record<string, keyof EstoqueMetricasResponseDto> = {
  "medicamentos ativos": "totalMedicamentosAtivos",
  "unidades físicas": "totalUnidadesFisicas",
  "itens em risco de ruptura": "itensRiscoRuptura",
  "lotes que vencem no mês corrente": "lotesValidadeMesAtual",
  "lotes com validade curta de 90 dias": "lotesValidadeCurta90d",
  "lotes vencidos": "lotesVencidos",
};

let hoje = "2026-10-13";
let dados = new Map<string, DadosUbs>();
let repositorio: RepositorioMetricasFake;
let resultado: EstoqueMetricasResponseDto;

/** Obtém (ou cria vazio) os dados da UBS informada. */
function dadosDaUbs(ubsId: string): DadosUbs {
  let d = dados.get(ubsId);
  if (!d) {
    d = {
      totalMedicamentosAtivos: 0,
      totalUnidadesFisicas: 0,
      consumo: [],
      lotes: [],
    };
    dados.set(ubsId, d);
  }
  return d;
}

Before(() => {
  hoje = "2026-10-13";
  dados = new Map();
});

Given(
  "que a data de referência das métricas de estoque é {string}",
  (data: string) => {
    hoje = data;
  },
);

Given(
  "a UBS {string} possui {int} medicamentos ativos e {int} unidades físicas no estoque de métricas",
  (ubsId: string, medicamentos: number, unidades: number) => {
    const d = dadosDaUbs(ubsId);
    d.totalMedicamentosAtivos = medicamentos;
    d.totalUnidadesFisicas = unidades;
  },
);

Given(
  "a UBS {string} possui os seguintes produtos com consumo apurado no estoque de métricas:",
  (ubsId: string, tabela: DataTable) => {
    dadosDaUbs(ubsId).consumo = tabela.hashes().map((l) => ({
      produtoId: l.produto,
      saldoAtual: Number(l.saldo),
      totalDispensado: Number(l.dispensado),
      diasApurados: Number(l.dias),
    }));
  },
);

Given(
  "a UBS {string} possui os seguintes lotes no estoque de métricas:",
  (ubsId: string, tabela: DataTable) => {
    dadosDaUbs(ubsId).lotes = tabela.hashes().map((l) => ({
      loteId: l.lote,
      validade: l.validade,
      saldoAtual: Number(l.saldo),
    }));
  },
);

When(
  "o farmacêutico consulta as métricas de estoque da UBS {string}",
  async (ubsId: string) => {
    repositorio = new RepositorioMetricasFake(dados);
    const useCase = new ObterMetricasEstoqueUseCase(repositorio);
    resultado = await useCase.executar(ubsId, hoje, AGORA_FIXA);
  },
);

Then("as métricas de estoque devem apresentar:", (tabela: DataTable) => {
  for (const linha of tabela.hashes()) {
    const campo = CAMPOS[linha.indicador];
    expect(campo, `indicador desconhecido: ${linha.indicador}`).to.not.equal(
      undefined,
    );
    expect(resultado[campo], linha.indicador).to.equal(Number(linha.valor));
  }
});

Then(
  "a data do cálculo das métricas de estoque deve ser {string}",
  (iso: string) => {
    expect(resultado.calculadoEm).to.equal(iso);
  },
);

Then(
  "o repositório de métricas deve ter sido consultado apenas para a UBS {string}",
  (ubsId: string) => {
    expect(repositorio.consultas.length).to.be.greaterThan(0);
    expect(new Set(repositorio.consultas)).to.deep.equal(new Set([ubsId]));
  },
);
