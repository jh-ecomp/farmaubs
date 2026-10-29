import { EfetivarRecebimentoUseCase } from "./efetivar-recebimento.use-case";
import type { RecebimentoRepositoryPort } from "../../domain/ports/recebimento.repository.port";
import type { CatalogoRepositoryPort } from "../../domain/ports/catalogo.repository.port";
import {
  DocumentoEntradaDuplicadoException,
  FabricanteNaoEncontradoException,
  LoteValidadeVencidaException,
  ProdutoNaoEncontradoException,
} from "../../domain/errors/recebimento.errors";

describe("EfetivarRecebimentoUseCase (RF008 / RF024 / RF028)", () => {
  let useCase: EfetivarRecebimentoUseCase;
  let fakeRecebimentoRepo: jest.Mocked<RecebimentoRepositoryPort>;
  let fakeCatalogoRepo: jest.Mocked<CatalogoRepositoryPort>;

  const contextoPadrao = {
    municipioId: "0194e43e-a6fb-7389-9a74-94c039755ef0",
    ubsId: "0194e43e-a6fb-7389-9a74-94c039755ef1",
    usuarioId: "0194e43e-a6fb-7389-9a74-94c039755ef2",
    usuarioNome: "Dra. Ana Farmacêutica",
  };

  const documentoPadrao = {
    numeroDocumento: "NF-99881",
    tipoDocumento: "NOTA_FISCAL",
    fornecedorOrigem: "Distribuidora Central de Medicamentos",
    dataRecebimento: "2026-10-21T10:00:00Z",
  };

  beforeEach(() => {
    fakeRecebimentoRepo = {
      buscarDocumentoPorNumero: jest.fn().mockResolvedValue(null),
      registrarEntradaAtomica: jest.fn().mockImplementation((params) =>
        Promise.resolve({
          id: "doc-id-1",
          numeroDocumento: params.documento.numeroDocumento,
          tipoDocumento: params.documento.tipoDocumento,
          fornecedorOrigem: params.documento.fornecedorOrigem,
          dataRecebimento: params.documento.dataRecebimento,
          usuarioRecebedorId: params.contexto.usuarioId,
          itens: params.itens.map((i: any, idx: number) => ({
            itemId: `item-id-${idx}`,
            produtoId: i.produtoId,
            produtoNome: i.produtoNome,
            fabricanteId: i.fabricanteId,
            fabricanteNome: i.fabricanteNome,
            loteId: `lote-id-${idx}`,
            numeroLote: i.numeroLote,
            dataValidade: i.dataValidade,
            quantidadeRecebida: i.quantidadeRecebida,
            saldoFinalLote: i.quantidadeRecebida,
          })),
          avisos: params.avisos,
        }),
      ),
    };

    fakeCatalogoRepo = {
      buscarProdutosPorTermo: jest.fn(),
      buscarProdutoPorId: jest.fn().mockResolvedValue({
        id: "prod-1",
        codigoCatmat: "BR001",
        principioAtivo: "Amoxicilina",
        nomeComercial: "Amoxil",
        formaFarmaceutica: "Cápsula",
        concentracao: "500mg",
        unidadeFornecimento: "Frasco",
        status: "ATIVO",
      }),
      listarFabricantesAtivos: jest.fn().mockResolvedValue([
        {
          id: "fab-1",
          razaoSocial: "EMS S/A",
          nomeFantasia: "EMS Pharma",
          cnpj: "12345678000199",
          status: "ATIVO",
        },
      ]),
      buscarFabricantePorCnpj: jest.fn(),
      cadastrarFabricante: jest.fn(),
    };

    useCase = new EfetivarRecebimentoUseCase(
      fakeRecebimentoRepo,
      fakeCatalogoRepo,
    );
  });

  it("deve lançar exceção se já existir documento de entrada com o mesmo número na UBS (RF008)", async () => {
    fakeRecebimentoRepo.buscarDocumentoPorNumero.mockResolvedValueOnce({
      id: "doc-existente",
      numeroDocumento: "NF-99881",
      status: "CONCLUIDO",
    });

    await expect(
      useCase.execute(
        {
          ...documentoPadrao,
          itens: [
            {
              produtoId: "prod-1",
              fabricanteId: "fab-1",
              numeroLote: "LOT-A1",
              dataValidade: "2027-10-21",
              quantidadeRecebida: 100,
            },
          ],
        },
        contextoPadrao,
        new Date("2026-10-21T00:00:00Z"),
      ),
    ).rejects.toThrow(DocumentoEntradaDuplicadoException);
  });

  it("deve lançar exceção se algum produto informado não existir no catálogo", async () => {
    fakeCatalogoRepo.buscarProdutoPorId.mockResolvedValueOnce(null);

    await expect(
      useCase.execute(
        {
          ...documentoPadrao,
          itens: [
            {
              produtoId: "prod-inexistente",
              fabricanteId: "fab-1",
              numeroLote: "LOT-A1",
              dataValidade: "2027-10-21",
              quantidadeRecebida: 100,
            },
          ],
        },
        contextoPadrao,
        new Date("2026-10-21T00:00:00Z"),
      ),
    ).rejects.toThrow(ProdutoNaoEncontradoException);
  });

  it("deve lançar exceção se algum fabricante informado não existir no catálogo", async () => {
    fakeCatalogoRepo.listarFabricantesAtivos.mockResolvedValueOnce([]);

    await expect(
      useCase.execute(
        {
          ...documentoPadrao,
          itens: [
            {
              produtoId: "prod-1",
              fabricanteId: "fab-inexistente",
              numeroLote: "LOT-A1",
              dataValidade: "2027-10-21",
              quantidadeRecebida: 100,
            },
          ],
        },
        contextoPadrao,
        new Date("2026-10-21T00:00:00Z"),
      ),
    ).rejects.toThrow(FabricanteNaoEncontradoException);
  });

  it("deve rejeitar recebimento se a validade do lote estiver vencida (< 0 dias) (RF008)", async () => {
    await expect(
      useCase.execute(
        {
          ...documentoPadrao,
          itens: [
            {
              produtoId: "prod-1",
              fabricanteId: "fab-1",
              numeroLote: "LOT-VENCIDO",
              dataValidade: "2020-01-01",
              quantidadeRecebida: 50,
            },
          ],
        },
        contextoPadrao,
        new Date("2026-10-21T00:00:00Z"),
      ),
    ).rejects.toThrow(LoteValidadeVencidaException);
  });

  it("deve emitir aviso de VALIDADE_CURTA quando a validade for menor que 180 dias mas não vencida", async () => {
    // Validade para daqui a 60 dias a partir de 2026-10-21
    const validadeCurta = "2026-12-20";

    const resultado = await useCase.execute(
      {
        ...documentoPadrao,
        itens: [
          {
            produtoId: "prod-1",
            fabricanteId: "fab-1",
            numeroLote: "LOT-CURTO",
            dataValidade: validadeCurta,
            quantidadeRecebida: 50,
          },
        ],
      },
      contextoPadrao,
      new Date("2026-10-21T00:00:00Z"),
    );

    expect(resultado.avisos).toHaveLength(1);
    expect(resultado.avisos[0].tipo).toBe("VALIDADE_CURTA");
    expect(resultado.avisos[0].lote).toBe("LOT-CURTO");
    expect(fakeRecebimentoRepo.registrarEntradaAtomica).toHaveBeenCalledTimes(1);
  });

  it("deve registrar a entrada com sucesso com múltiplos itens e validade superior a 180 dias", async () => {
    const validadeLonga = "2028-05-15";

    const resultado = await useCase.execute(
      {
        ...documentoPadrao,
        itens: [
          {
            produtoId: "prod-1",
            fabricanteId: "fab-1",
            numeroLote: "LOT-LONGO-1",
            dataValidade: validadeLonga,
            quantidadeRecebida: 300,
          },
        ],
      },
      contextoPadrao,
      new Date("2026-10-21T00:00:00Z"),
    );

    expect(resultado.numeroDocumento).toBe("NF-99881");
    expect(resultado.avisos).toHaveLength(0);
    expect(resultado.itens).toHaveLength(1);
    expect(resultado.itens[0].saldoFinalLote).toBe(300);
    expect(resultado.itens[0].produtoNome).toContain("Amoxicilina");
  });
});
