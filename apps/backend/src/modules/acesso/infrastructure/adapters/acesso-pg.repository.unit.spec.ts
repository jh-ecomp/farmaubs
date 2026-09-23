import { AcessoPgRepository } from "./acesso-pg.repository";
import type { DataSource } from "typeorm";

describe("AcessoPgRepository (Testes Unitários em Memória — Camada A)", () => {
  let repository: AcessoPgRepository;
  let dataSourceMock: { query: jest.Mock };

  beforeEach(() => {
    dataSourceMock = {
      query: jest.fn(),
    };
    repository = new AcessoPgRepository(
      dataSourceMock as unknown as DataSource,
    );
  });

  describe("buscarUsuarioPorEmail", () => {
    it("deve retornar o registro mapeado quando o usuário for encontrado", async () => {
      const dbRow = {
        id: "user-123",
        municipio_id: "muni-456",
        email: "carlos@ubs.gov.br",
        senha_hash: "$2b$12$hashsenha",
        ativo: true,
        tentativas_login_falhas: 0,
        bloqueado_ate: null,
        nome_completo: "Carlos Eduardo",
        perfil_codigo: "FARMACEUTICO_RESPONSAVEL",
        unidade_ids: ["ubs-1"],
        deve_trocar_senha: false,
      };

      dataSourceMock.query.mockResolvedValue([dbRow]);

      const resultado =
        await repository.buscarUsuarioPorEmail("carlos@ubs.gov.br");

      expect(dataSourceMock.query).toHaveBeenCalledWith(
        "SELECT * FROM auth_buscar_usuario_por_email($1::text)",
        ["carlos@ubs.gov.br"],
      );
      expect(resultado).toEqual({
        id: "user-123",
        municipioId: "muni-456",
        email: "carlos@ubs.gov.br",
        senhaHash: "$2b$12$hashsenha",
        ativo: true,
        tentativasLoginFalhas: 0,
        bloqueadoAte: null,
        nomeCompleto: "Carlos Eduardo",
        perfilCodigo: "FARMACEUTICO_RESPONSAVEL",
        unidadeIds: ["ubs-1"],
        deveTrocarSenha: false,
      });
    });

    it("deve retornar null se o usuário não for encontrado", async () => {
      dataSourceMock.query.mockResolvedValue([]);

      const resultado = await repository.buscarUsuarioPorEmail(
        "inexistente@ubs.gov.br",
      );

      expect(resultado).toBeNull();
    });

    it("deve converter bloqueado_ate em objeto Date quando presente", async () => {
      const dataBloqueio = "2026-09-22T12:00:00.000Z";
      const dbRow = {
        id: "user-123",
        municipio_id: "muni-456",
        email: "bloqueado@ubs.gov.br",
        senha_hash: "$2b$12$hashsenha",
        ativo: true,
        tentativas_login_falhas: 5,
        bloqueado_ate: dataBloqueio,
        nome_completo: "Carlos Eduardo",
        perfil_codigo: "FARMACEUTICO_RESPONSAVEL",
        unidade_ids: ["ubs-1"],
        deve_trocar_senha: false,
      };

      dataSourceMock.query.mockResolvedValue([dbRow]);

      const resultado = await repository.buscarUsuarioPorEmail(
        "bloqueado@ubs.gov.br",
      );

      expect(resultado?.bloqueadoAte).toEqual(new Date(dataBloqueio));
    });
  });

  describe("registrarFalhaLogin", () => {
    it("deve chamar auth_registrar_falha_login com o ID do usuário", async () => {
      dataSourceMock.query.mockResolvedValue([]);

      await repository.registrarFalhaLogin("user-123");

      expect(dataSourceMock.query).toHaveBeenCalledWith(
        "SELECT auth_registrar_falha_login($1::uuid)",
        ["user-123"],
      );
    });
  });

  describe("resetarEstadoLogin", () => {
    it("deve chamar auth_resetar_estado_login com o ID do usuário", async () => {
      dataSourceMock.query.mockResolvedValue([]);

      await repository.resetarEstadoLogin("user-123");

      expect(dataSourceMock.query).toHaveBeenCalledWith(
        "SELECT auth_resetar_estado_login($1::uuid)",
        ["user-123"],
      );
    });
  });

  describe("criarSessao", () => {
    it("deve gerar token aleatório e invocar auth_criar_sessao com hash sha256", async () => {
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

  describe("buscarEscopoUsuario", () => {
    it("deve retornar o escopo do usuário quando encontrado", async () => {
      dataSourceMock.query.mockResolvedValueOnce([
        {
          perfil_id: "perfil-1",
          unidade_ids: ["ubs-1", "ubs-2"],
        },
      ]);

      const resultado = await repository.buscarEscopoUsuario("user-123");

      expect(dataSourceMock.query).toHaveBeenCalledWith(
        "SELECT * FROM auth_buscar_escopo_usuario($1::uuid)",
        ["user-123"],
      );
      expect(resultado).toEqual({
        perfilId: "perfil-1",
        unidadeIds: ["ubs-1", "ubs-2"],
      });
    });

    it("deve lançar erro se o usuário não for encontrado", async () => {
      dataSourceMock.query.mockResolvedValueOnce([]);

      await expect(
        repository.buscarEscopoUsuario("inexistente"),
      ).rejects.toThrow('Usuário "inexistente" não encontrado');
    });
  });
});
