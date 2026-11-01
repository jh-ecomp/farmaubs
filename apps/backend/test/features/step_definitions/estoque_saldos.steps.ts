import { Before, Given, Then, When } from "@cucumber/cucumber";
import type { DataTable } from "@cucumber/cucumber";
import { expect } from "chai";
import type {
  ConsultarSaldosPaginadosResponseDto,
  FiltroValidadeSaldos,
} from "@farmaubs/shared";
import { ConsultarSaldosPaginadosUseCase } from "../../../src/modules/estoque/application/use-cases/consultar-saldos-paginados.use-case";
import type {
  FiltrosConsultaSaldos,
  LoteSaldoAgregado,
  ProdutoSaldoAgregado,
  RepositorioEstoqueSaldosPort,
  ResultadoSaldosPaginados,
} from "../../../src/modules/estoque/domain/ports/estoque-saldos.repository.port";

/** Lote em memória; `medicamento` é o nome exibido e a chave de agrupamento. */
interface LoteFake {
  medicamento: string;
  lote: string;
  validade: string; // 'AAAA-MM-DD'
  saldo: number;
}

const JANELA_CONSUMO_PADRAO = 90;

/**
 * Repositório em memória que registra as UBSs consultadas.
 * Simula só o que estes cenários exercitam: agrupamento por medicamento, filtro de
 * validade do mês corrente e paginação por medicamento. Busca, categoria e status de
 * estoque são cobertos pelo teste de integração (Camada C), contra o PostgreSQL.
 */
class RepositorioSaldosFake implements RepositorioEstoqueSaldosPort {
  readonly consultas: string[] = [];

  constructor(private readonly lotesPorUbs: Map<string, LoteFake[]>) {}

  async consultarSaldosPaginados(
    ubsId: string,
    filtros: FiltrosConsultaSaldos,
    hoje: string,
  ): Promise<ResultadoSaldosPaginados> {
    this.consultas.push(ubsId);
    const lotes = this.lotesPorUbs.get(ubsId) ?? [];

    const porMedicamento = new Map<string, LoteFake[]>();
    for (const l of lotes) {
      const lista = porMedicamento.get(l.medicamento) ?? [];
      lista.push(l);
      porMedicamento.set(l.medicamento, lista);
    }

    const atendeValidade = (l: LoteFake): boolean => {
      if (l.saldo <= 0) return false;
      switch (filtros.filtroValidade) {
        case "MES_CORRENTE":
          return (
            l.validade >= hoje && l.validade.slice(0, 7) === hoje.slice(0, 7)
          );
        case "VENCIDOS":
          return l.validade < hoje;
        default:
          return true;
      }
    };

    const medicamentos = [...porMedicamento.entries()]
      .filter(
        ([, ls]) =>
          filtros.filtroValidade === "TODOS" || ls.some(atendeValidade),
      )
      .sort(([a], [b]) => a.toLowerCase().localeCompare(b.toLowerCase()));

    const inicio = (filtros.pagina - 1) * filtros.itensPorPagina;
    const pagina = medicamentos.slice(inicio, inicio + filtros.itensPorPagina);

    const itens: ProdutoSaldoAgregado[] = pagina.map(([nome, ls]) => {
      const ativos = ls.filter((l) => l.saldo > 0);
      const lotesAgregados: LoteSaldoAgregado[] = ativos.map((l) => ({
        id: `${nome}-${l.lote}`,
        numeroLote: l.lote,
        fabricanteId: "fab-teste",
        fabricanteNome: "Fabricante Teste",
        dataValidade: l.validade,
        saldoAtual: l.saldo,
      }));
      return {
        produtoId: `prod-${nome}`,
        nome,
        principioAtivo: nome,
        formaFarmaceutica: "",
        concentracao: "",
        unidadeMedida: "",
        categoria: "GERAL",
        saldoTotal: ativos.reduce((soma, l) => soma + l.saldo, 0),
        totalDispensado: 0,
        diasApurados: JANELA_CONSUMO_PADRAO,
        lotes: lotesAgregados,
      };
    });

    return { itens, total: medicamentos.length };
  }
}

let hoje = "2026-10-13";
let lotesPorUbs = new Map<string, LoteFake[]>();
let repositorio: RepositorioSaldosFake;
let resultado: ConsultarSaldosPaginadosResponseDto;

/** Executa o caso de uso real contra o repositório fake. */
async function consultar(
  ubsId: string,
  filtros: Partial<FiltrosConsultaSaldos>,
): Promise<void> {
  repositorio = new RepositorioSaldosFake(lotesPorUbs);
  const useCase = new ConsultarSaldosPaginadosUseCase(repositorio);
  resultado = await useCase.executar(
    ubsId,
    {
      filtroValidade: "TODOS",
      statusEstoque: "TODOS",
      pagina: 1,
      itensPorPagina: 20,
      ...filtros,
    },
    hoje,
  );
}

/** Localiza o medicamento da página retornada, falhando com mensagem clara. */
function medicamentoDaPagina(nome: string) {
  const item = resultado.itens.find((i) => i.nome === nome);
  expect(item, `medicamento ausente na página: ${nome}`).to.not.equal(
    undefined,
  );
  return item!;
}

Before(() => {
  hoje = "2026-10-13";
  lotesPorUbs = new Map();
});

Given(
  "que a data de referência dos saldos de estoque é {string}",
  (data: string) => {
    hoje = data;
  },
);

Given(
  "a UBS {string} possui os seguintes lotes ativos por medicamento nos saldos de estoque:",
  (ubsId: string, tabela: DataTable) => {
    lotesPorUbs.set(
      ubsId,
      tabela.hashes().map((l) => ({
        medicamento: l.medicamento,
        lote: l.lote,
        validade: l.validade,
        saldo: Number(l.saldo),
      })),
    );
  },
);

When(
  "o farmacêutico consulta os saldos de estoque da UBS {string} na página {int} com {int} itens por página",
  async (ubsId: string, pagina: number, itensPorPagina: number) => {
    await consultar(ubsId, { pagina, itensPorPagina });
  },
);

When(
  "o farmacêutico consulta os saldos de estoque da UBS {string} com o filtro de validade {string}",
  async (ubsId: string, filtro: string) => {
    await consultar(ubsId, { filtroValidade: filtro as FiltroValidadeSaldos });
  },
);

Then(
  "a consulta de saldos deve retornar {int} medicamentos de um total de {int} em {int} páginas",
  (itens: number, total: number, paginas: number) => {
    expect(resultado.itens, "itens na página").to.have.length(itens);
    expect(resultado.total, "total de medicamentos").to.equal(total);
    expect(resultado.totalPaginas, "total de páginas").to.equal(paginas);
  },
);

Then(
  "o medicamento {string} deve listar os lotes de saldos na ordem: {string}",
  (nome: string, ordem: string) => {
    const esperados = ordem.split(",").map((s) => s.trim());
    const obtidos = medicamentoDaPagina(nome).lotes.map((l) => l.numeroLote);
    expect(obtidos).to.deep.equal(esperados);
  },
);

Then(
  "o medicamento {string} deve ter saldo total de {int} unidades nos saldos de estoque",
  (nome: string, saldoTotal: number) => {
    expect(medicamentoDaPagina(nome).saldoTotal).to.equal(saldoTotal);
  },
);

Then(
  "os lotes do medicamento {string} devem ter os status de validade de saldos: {string}",
  (nome: string, esperado: string) => {
    const pares = esperado.split(",").map((s) => s.trim().split("="));
    const obtidos = medicamentoDaPagina(nome).lotes.map((l) => [
      l.numeroLote,
      l.statusValidade,
    ]);
    expect(obtidos).to.deep.equal(pares);
  },
);

Then(
  "o repositório de saldos deve ter sido consultado apenas para a UBS {string}",
  (ubsId: string) => {
    expect(repositorio.consultas.length).to.be.greaterThan(0);
    expect(new Set(repositorio.consultas)).to.deep.equal(new Set([ubsId]));
  },
);
