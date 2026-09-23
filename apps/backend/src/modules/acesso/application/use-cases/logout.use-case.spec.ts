import * as crypto from "node:crypto";
import { LogoutUseCase } from "./logout.use-case";
import type {
  ISessionRepository,
  SessionRecord,
} from "../../domain/ports/session.repository.port";

describe("LogoutUseCase (Camada A — Teste Unitário)", () => {
  let useCase: LogoutUseCase;
  let sessionRepoMock: jest.Mocked<ISessionRepository>;

  const tokenValido = "token-secreto-123456";
  const tokenHashEsperado = crypto
    .createHash("sha256")
    .update(tokenValido)
    .digest("hex");

  const sessaoMock: SessionRecord = {
    id: "session-uuid-1",
    usuarioId: "user-uuid-1",
    municipioId: "muni-uuid-1",
    perfilCodigo: "ADMINISTRADOR",
    unidadeIds: ["unidade-uuid-1"],
    nomeCompleto: "João Silva",
    email: "joao@ubs.gov.br",
    deveTrocarSenha: false,
    status: "ativa",
    expiraEm: new Date(Date.now() + 3600000),
    criadoEm: new Date(),
    ultimaAtividadeEm: new Date(),
  };

  beforeEach(() => {
    sessionRepoMock = {
      buscarPorTokenHash: jest.fn(),
      renovarAtividade: jest.fn(),
      revogar: jest.fn().mockResolvedValue(undefined),
      revogarTodas: jest.fn(),
    };
    useCase = new LogoutUseCase(sessionRepoMock);
  });

  it("deve revogar uma sessão ativa com sucesso pelo id", async () => {
    sessionRepoMock.buscarPorTokenHash.mockResolvedValue(sessaoMock);

    await useCase.executar(tokenValido);

    expect(sessionRepoMock.buscarPorTokenHash).toHaveBeenCalledTimes(1);
    expect(sessionRepoMock.buscarPorTokenHash).toHaveBeenCalledWith(
      tokenHashEsperado,
    );
    expect(sessionRepoMock.revogar).toHaveBeenCalledTimes(1);
    expect(sessionRepoMock.revogar).toHaveBeenCalledWith(sessaoMock.id);
  });

  it("deve ser idempotente quando o token não corresponder a nenhuma sessão existente", async () => {
    sessionRepoMock.buscarPorTokenHash.mockResolvedValue(null);

    await expect(useCase.executar("token-inexistente")).resolves.toBeUndefined();

    expect(sessionRepoMock.buscarPorTokenHash).toHaveBeenCalledTimes(1);
    expect(sessionRepoMock.revogar).not.toHaveBeenCalled();
  });

  it("deve ser idempotente quando a sessão já estiver revogada ou inativa", async () => {
    sessionRepoMock.buscarPorTokenHash.mockResolvedValue({
      ...sessaoMock,
      status: "revogada",
    });

    await expect(useCase.executar(tokenValido)).resolves.toBeUndefined();

    expect(sessionRepoMock.buscarPorTokenHash).toHaveBeenCalledTimes(1);
    expect(sessionRepoMock.revogar).not.toHaveBeenCalled();
  });

  it("deve concluir sem chamar o repositório se o token for vazio ou em branco", async () => {
    await useCase.executar("");
    await useCase.executar("   ");

    expect(sessionRepoMock.buscarPorTokenHash).not.toHaveBeenCalled();
    expect(sessionRepoMock.revogar).not.toHaveBeenCalled();
  });
});
