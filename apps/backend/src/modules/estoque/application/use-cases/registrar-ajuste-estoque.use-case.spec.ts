import type { RegistrarAjusteLoteInputDto } from "@farmaubs/shared";
import {
  DadosAjusteInvalidosException,
  JustificativaInvalidaException,
  LoteNaoEncontradoException,
  MotivoIncompativelException,
  SaldoInsuficienteException,
} from "../../domain/errors/ajuste-estoque.errors";
import type {
  LoteBloqueadoAjuste,
  RepositorioEstoqueAjustesPort,
} from "../../domain/ports/estoque-ajustes.repository.port";
import { RegistrarAjusteEstoqueUseCase } from "./registrar-ajuste-estoque.use-case";

const UBS = "ubs-1";
const contexto = {
  usuarioId: "u-1",
  usuarioNome: "Farma Teste",
  unidadeIds: [UBS],
};

function criarRepo(lote: LoteBloqueadoAjuste | null) {
  return {
    bloquearLotePorId: jest.fn().mockResolvedValue(lote),
    atualizarSaldo: jest.fn().mockResolvedValue(undefined),
    registrarMovimentacao: jest
      .fn()
      .mockResolvedValue({ id: "mov-1", dataHora: "2026-11-05T12:00:00.000Z" }),
  } satisfies RepositorioEstoqueAjustesPort;
}

const lotePadrao = (saldo: number): LoteBloqueadoAjuste => ({
  id: "lote-1",
  municipioId: "mun-1",
  ubsId: UBS,
  saldoAtual: saldo,
});

const entrada = (
  o: Partial<RegistrarAjusteLoteInputDto> = {},
): RegistrarAjusteLoteInputDto => ({
  tipoOperacao: "ENTRADA",
  quantidade: 10,
  motivo: "DEVOLUCAO_PACIENTE",
  justificativa: "Paciente devolveu 10 comprimidos lacrados",
  ...o,
});

describe("RegistrarAjusteEstoqueUseCase", () => {
  it("entrada soma ao saldo e audita como AJUSTE_ENTRADA", async () => {
    const repo = criarRepo(lotePadrao(50));
    const r = await new RegistrarAjusteEstoqueUseCase(repo).execute(
      "lote-1",
      entrada(),
      contexto,
    );

    expect(r.saldoAnterior).toBe(50);
    expect(r.saldoAtualizado).toBe(60);
    expect(repo.atualizarSaldo).toHaveBeenCalledWith("lote-1", 60);
    expect(repo.registrarMovimentacao).toHaveBeenCalledWith(
      expect.objectContaining({
        tipoMovimentacao: "AJUSTE_ENTRADA",
        motivo: "DEVOLUCAO_PACIENTE",
        usuarioId: "u-1",
        saldoAnterior: 50,
        saldoPosterior: 60,
      }),
    );
  });

  it("saída subtrai do saldo e audita como AJUSTE_SAIDA", async () => {
    const repo = criarRepo(lotePadrao(15));
    const r = await new RegistrarAjusteEstoqueUseCase(repo).execute(
      "lote-1",
      entrada({
        tipoOperacao: "SAIDA",
        quantidade: 2,
        motivo: "AVARIA_FISICA",
        justificativa: "Queda acidental de 2 frascos com quebra de vidro",
      }),
      contexto,
    );
    expect(r.saldoAtualizado).toBe(13);
    expect(repo.registrarMovimentacao).toHaveBeenCalledWith(
      expect.objectContaining({
        tipoMovimentacao: "AJUSTE_SAIDA",
        motivo: "AVARIA_FISICA",
      }),
    );
  });

  it("saída maior que o saldo lança SaldoInsuficienteException sem gravar nada", async () => {
    const repo = criarRepo(lotePadrao(5));
    await expect(
      new RegistrarAjusteEstoqueUseCase(repo).execute(
        "lote-1",
        entrada({
          tipoOperacao: "SAIDA",
          quantidade: 10,
          motivo: "EXTRAVIO",
          justificativa: "Falta física sem correlação de dispensação",
        }),
        contexto,
      ),
    ).rejects.toBeInstanceOf(SaldoInsuficienteException);
    expect(repo.atualizarSaldo).not.toHaveBeenCalled();
    expect(repo.registrarMovimentacao).not.toHaveBeenCalled();
  });

  it("saída igual ao saldo é permitida e zera o lote", async () => {
    const repo = criarRepo(lotePadrao(5));
    const r = await new RegistrarAjusteEstoqueUseCase(repo).execute(
      "lote-1",
      entrada({
        tipoOperacao: "SAIDA",
        quantidade: 5,
        motivo: "VENCIMENTO",
        justificativa: "Descarte regulamentar de lote vencido",
      }),
      contexto,
    );
    expect(r.saldoAtualizado).toBe(0);
  });

  it("rejeita motivo incompatível com o tipo (VENCIMENTO em ENTRADA)", async () => {
    const repo = criarRepo(lotePadrao(50));
    await expect(
      new RegistrarAjusteEstoqueUseCase(repo).execute(
        "lote-1",
        entrada({ motivo: "VENCIMENTO" }),
        contexto,
      ),
    ).rejects.toBeInstanceOf(MotivoIncompativelException);
    expect(repo.bloquearLotePorId).not.toHaveBeenCalled();
  });

  it.each([
    ["justificativa curta", entrada({ justificativa: "curta" })],
    ["só espaços", entrada({ justificativa: "           " })],
    [
      "OUTRO com 15 caracteres",
      entrada({ motivo: "OUTRO", justificativa: "quinze caracter" }),
    ],
    ["acima de 500", entrada({ justificativa: "a".repeat(501) })],
  ])("rejeita justificativa inválida: %s", async (_nome, req) => {
    const repo = criarRepo(lotePadrao(50));
    await expect(
      new RegistrarAjusteEstoqueUseCase(repo).execute("lote-1", req, contexto),
    ).rejects.toBeInstanceOf(JustificativaInvalidaException);
  });

  it.each([0, -3, 1.5])(
    "rejeita quantidade inválida (%p)",
    async (quantidade) => {
      const repo = criarRepo(lotePadrao(50));
      await expect(
        new RegistrarAjusteEstoqueUseCase(repo).execute(
          "lote-1",
          entrada({ quantidade }),
          contexto,
        ),
      ).rejects.toBeInstanceOf(DadosAjusteInvalidosException);
    },
  );

  it("lote inexistente ou de outra UBS lança LoteNaoEncontradoException", async () => {
    const inexistente = criarRepo(null);
    await expect(
      new RegistrarAjusteEstoqueUseCase(inexistente).execute(
        "x",
        entrada(),
        contexto,
      ),
    ).rejects.toBeInstanceOf(LoteNaoEncontradoException);

    const outraUbs = criarRepo({ ...lotePadrao(50), ubsId: "ubs-2" });
    await expect(
      new RegistrarAjusteEstoqueUseCase(outraUbs).execute(
        "lote-1",
        entrada(),
        contexto,
      ),
    ).rejects.toBeInstanceOf(LoteNaoEncontradoException);
    expect(outraUbs.atualizarSaldo).not.toHaveBeenCalled();
  });

  it("exige usuário identificado na sessão", async () => {
    const repo = criarRepo(lotePadrao(50));
    await expect(
      new RegistrarAjusteEstoqueUseCase(repo).execute("lote-1", entrada(), {
        ...contexto,
        usuarioId: "",
      }),
    ).rejects.toBeInstanceOf(DadosAjusteInvalidosException);
  });
});
