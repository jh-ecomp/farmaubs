import { SessionPgRepository } from "./session-pg.repository";
import type { DataSource } from "typeorm";

describe("SessionPgRepository (Testes Unitários em Memória — Camada A)", () => {
  let repository: SessionPgRepository;
  let dataSourceMock: { query: jest.Mock };

  beforeEach(() => {
    dataSourceMock = {
      query: jest.fn(),
    };
    repository = new SessionPgRepository(
      dataSourceMock as unknown as DataSource,
    );
  });

  describe("buscarPorTokenHash", () => {
    it("deve retornar o registro mapeado de sessão quando encontrada", async () => {
      const now = new Date();
      const expira = new Date(now.getTime() + 3600000);
      const dbRow = {
        id: "session-1",
        usuario_id: "user-1",
        municipio_id: "muni-1",
        perfil_id: "perfil-1",
        unidade_ids: ["ubs-1"],
        status: "ativa",
        expira_em: expira.toISOString(),
        criado_em: now.toISOString(),
        ultima_atividade_em: now.toISOString(),
      };

      dataSourceMock.query.mockResolvedValue([dbRow]);

      const resultado = await repository.buscarPorTokenHash("hash123");

      expect(dataSourceMock.query).toHaveBeenCalledWith(
        "SELECT * FROM auth_buscar_sessao_por_token($1)",
        ["hash123"],
      );
      expect(resultado).toEqual({
        id: "session-1",
        usuarioId: "user-1",
        municipioId: "muni-1",
        perfilId: "perfil-1",
        unidadeIds: ["ubs-1"],
        status: "ativa",
        expiraEm: expira,
        criadoEm: now,
        ultimaAtividadeEm: now,
      });
    });

    it("deve retornar null quando a sessão não for encontrada", async () => {
      dataSourceMock.query.mockResolvedValue([]);

      const resultado = await repository.buscarPorTokenHash("tokenInvalido");

      expect(resultado).toBeNull();
    });

    it("deve atribuir array vazio se unidade_ids for nulo no banco", async () => {
      const now = new Date();
      const dbRow = {
        id: "session-2",
        usuario_id: "user-2",
        municipio_id: "muni-2",
        perfil_id: "perfil-2",
        unidade_ids: null,
        status: "ativa",
        expira_em: now.toISOString(),
        criado_em: now.toISOString(),
        ultima_atividade_em: now.toISOString(),
      };

      dataSourceMock.query.mockResolvedValue([dbRow]);

      const resultado = await repository.buscarPorTokenHash("hash456");

      expect(resultado?.unidadeIds).toEqual([]);
    });
  });

  describe("renovarAtividade", () => {
    it("deve invocar auth_renovar_sessao com sessionId e novo expiraEm", async () => {
      dataSourceMock.query.mockResolvedValue([]);
      const novoExpiraEm = new Date("2026-09-22T14:00:00.000Z");

      await repository.renovarAtividade({
        sessionId: "session-1",
        expiraEm: novoExpiraEm,
      });

      expect(dataSourceMock.query).toHaveBeenCalledWith(
        "SELECT auth_renovar_sessao($1, $2)",
        ["session-1", novoExpiraEm],
      );
    });
  });

  describe("revogar", () => {
    it("deve invocar auth_revogar_sessao com sessionId", async () => {
      dataSourceMock.query.mockResolvedValue([]);

      await repository.revogar("session-1");

      expect(dataSourceMock.query).toHaveBeenCalledWith(
        "SELECT auth_revogar_sessao($1)",
        ["session-1"],
      );
    });
  });

  describe("revogarTodas", () => {
    it("deve invocar auth_revogar_todas_sessoes com usuarioId", async () => {
      dataSourceMock.query.mockResolvedValue([]);

      await repository.revogarTodas("user-1");

      expect(dataSourceMock.query).toHaveBeenCalledWith(
        "SELECT auth_revogar_todas_sessoes($1)",
        ["user-1"],
      );
    });
  });
});
