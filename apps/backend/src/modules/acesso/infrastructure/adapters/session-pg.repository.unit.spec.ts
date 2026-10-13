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
        perfil_codigo: "FARMACEUTICO_RESPONSAVEL",
        unidade_ids: ["ubs-1"],
        nome_completo: "Carlos",
        email: "carlos@ubs.gov.br",
        deve_trocar_senha: false,
        status: "ativa",
        expira_em: expira.toISOString(),
        criado_em: now.toISOString(),
        ultima_atividade_em: now.toISOString(),
      };

      dataSourceMock.query.mockResolvedValue([dbRow]);

      const resultado = await repository.buscarPorTokenHash("hash123");

      expect(dataSourceMock.query).toHaveBeenCalledWith(
        "SELECT * FROM auth_buscar_sessao_por_token($1::text)",
        ["hash123"],
      );
      expect(resultado).toEqual({
        id: "session-1",
        usuarioId: "user-1",
        municipioId: "muni-1",
        perfilCodigo: "FARMACEUTICO_RESPONSAVEL",
        unidadeIds: ["ubs-1"],
        nomeCompleto: "Carlos",
        email: "carlos@ubs.gov.br",
        deveTrocarSenha: false,
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
        nome_completo: "Maria",
        email: "maria@ubs.gov.br",
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

  describe("limparExpiradas", () => {
    it("deve invocar auth_limpar_sessoes_expiradas com diasRetencao informado", async () => {
      dataSourceMock.query.mockResolvedValue([{ total: 5 }]);

      const total = await repository.limparExpiradas(15);

      expect(dataSourceMock.query).toHaveBeenCalledWith(
        "SELECT auth_limpar_sessoes_expiradas($1::int) AS total",
        [15],
      );
      expect(total).toBe(5);
    });

    it("deve usar default de 7 dias de retenção", async () => {
      dataSourceMock.query.mockResolvedValue([{ total: 0 }]);

      const total = await repository.limparExpiradas();

      expect(dataSourceMock.query).toHaveBeenCalledWith(
        "SELECT auth_limpar_sessoes_expiradas($1::int) AS total",
        [7],
      );
      expect(total).toBe(0);
    });
  });

  describe("criarSessao", () => {
    it("deve gerar token aleatório e invocar auth_criar_sessao com casts explícitos", async () => {
      dataSourceMock.query.mockResolvedValue([]);

      const expiraEm = new Date("2026-09-22T13:00:00.000Z");
      const token = await repository.criarSessao({
        usuarioId: "user-123",
        expiraEm,
        ipOrigem: "192.168.1.1",
        userAgent: "Mozilla/5.0",
      });

      expect(typeof token).toBe("string");
      expect(token).toHaveLength(64); // 32 bytes hex
      expect(dataSourceMock.query).toHaveBeenCalledWith(
        "SELECT auth_criar_sessao($1::uuid, $2::text, $3::timestamptz, $4::inet, $5::text)",
        [
          "user-123",
          expect.any(String), // tokenHash
          expiraEm,
          "192.168.1.1",
          "Mozilla/5.0",
        ],
      );
    });
  });
});
