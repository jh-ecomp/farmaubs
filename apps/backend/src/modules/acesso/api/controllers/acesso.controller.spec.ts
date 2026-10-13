import { Test, TestingModule } from "@nestjs/testing";
import { UnauthorizedException } from "@nestjs/common";
import type { Request } from "express";
import { AcessoController } from "./acesso.controller";
import { LoginUseCase } from "../../application/use-cases/login.use-case";
import { RenewSessionUseCase } from "../../application/use-cases/renew-session.use-case";
import { LogoutUseCase } from "../../application/use-cases/logout.use-case";
import { ChangePasswordUseCase } from "../../application/use-cases/change-password.use-case";
import { BadRequestException } from "@nestjs/common";
import {
  ConfirmacaoSenhaDivergenteException,
  NovaSenhaNaoPodeSerIgualProvisoriaException,
  SenhaFracaException,
} from "../../domain/errors/password.errors";

describe("AcessoController (Camada A — Teste Unitário)", () => {
  let controller: AcessoController;
  let loginUseCaseMock: jest.Mocked<LoginUseCase>;
  let renewSessionUseCaseMock: jest.Mocked<RenewSessionUseCase>;
  let logoutUseCaseMock: jest.Mocked<LogoutUseCase>;
  let changePasswordUseCaseMock: jest.Mocked<ChangePasswordUseCase>;

  let mockRes: {
    setHeader: jest.Mock;
    cookie: jest.Mock;
    clearCookie: jest.Mock;
    status: jest.Mock;
  };

  beforeEach(async () => {
    mockRes = {
      setHeader: jest.fn(),
      cookie: jest.fn(),
      clearCookie: jest.fn(),
      status: jest.fn(),
    };

    loginUseCaseMock = {
      executar: jest.fn(),
    } as unknown as jest.Mocked<LoginUseCase>;

    renewSessionUseCaseMock = {
      executar: jest.fn(),
    } as unknown as jest.Mocked<RenewSessionUseCase>;

    logoutUseCaseMock = {
      executar: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<LogoutUseCase>;

    changePasswordUseCaseMock = {
      executar: jest.fn().mockResolvedValue({
        sucesso: true,
        mensagem: "Senha alterada com sucesso.",
      }),
    } as unknown as jest.Mocked<ChangePasswordUseCase>;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AcessoController],
      providers: [
        { provide: LoginUseCase, useValue: loginUseCaseMock },
        { provide: RenewSessionUseCase, useValue: renewSessionUseCaseMock },
        { provide: LogoutUseCase, useValue: logoutUseCaseMock },
        { provide: ChangePasswordUseCase, useValue: changePasswordUseCaseMock },
      ],
    }).compile();

    controller = module.get<AcessoController>(AcessoController);
  });

  describe("POST /acesso/login", () => {
    it("deve emitir cookie farmaubs_session com HttpOnly e cabeçalho Authorization em caso de sucesso (AC-29)", async () => {
      const mockReq = {
        ip: "127.0.0.1",
        headers: { "user-agent": "JestTest" },
      } as unknown as Request;

      const expiresAt = new Date(Date.now() + 3600 * 1000);
      loginUseCaseMock.executar.mockResolvedValueOnce({
        ok: true,
        token: "token-sessao-123",
        usuario: {
          id: "u-1",
          nomeCompleto: "Usuario Teste",
          email: "teste@ubs.gov.br",
          perfil: "ADMINISTRADOR",
          ativo: true,
          deveTrocarSenha: false,
          municipioId: "m-1",
          unidadeIds: ["ubs-1"],
        },
        sessao: {
          id: "s-1",
          expiresAt,
          ttlSeconds: 3600,
          warningSeconds: 300,
        },
        redirectUrl: "/admin",
      });

      const response = await controller.login(
        { email: "teste@ubs.gov.br", senha: "Password@123" },
        mockReq,
        mockRes as unknown as Response,
      );

      expect(response).toHaveProperty("token", "token-sessao-123");
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        "Authorization",
        "Bearer token-sessao-123",
      );
      expect(mockRes.cookie).toHaveBeenCalledWith(
        "farmaubs_session",
        "token-sessao-123",
        expect.objectContaining({
          httpOnly: true,
          sameSite: "lax",
          path: "/api/v1",
          maxAge: 3600 * 1000,
        }),
      );
    });
  });

  describe("POST /acesso/logout", () => {
    it("deve delegar a revogação ao LogoutUseCase e limpar cookie quando o cabeçalho Authorization for válido", async () => {
      const mockReq = {
        headers: {
          authorization: "Bearer token-secreto-12345",
        },
      } as unknown as Request;

      await expect(
        controller.logout(mockReq, mockRes as unknown as Response),
      ).resolves.toBeUndefined();

      expect(logoutUseCaseMock.executar).toHaveBeenCalledTimes(1);
      expect(logoutUseCaseMock.executar).toHaveBeenCalledWith(
        "token-secreto-12345",
      );
      expect(mockRes.clearCookie).toHaveBeenCalledWith(
        "farmaubs_session",
        expect.objectContaining({
          path: "/api/v1",
          httpOnly: true,
          sameSite: "lax",
        }),
      );
    });

    it("deve revogar via cookie farmaubs_session quando não houver cabeçalho Authorization (AC-29)", async () => {
      const mockReq = {
        cookies: {
          farmaubs_session: "token-cookie-abc",
        },
        headers: {},
      } as unknown as Request;

      await expect(
        controller.logout(mockReq, mockRes as unknown as Response),
      ).resolves.toBeUndefined();

      expect(logoutUseCaseMock.executar).toHaveBeenCalledWith("token-cookie-abc");
      expect(mockRes.clearCookie).toHaveBeenCalledWith(
        "farmaubs_session",
        expect.objectContaining({
          path: "/api/v1",
          httpOnly: true,
          sameSite: "lax",
        }),
      );
    });

    it("deve lançar UnauthorizedException quando tanto o cookie quanto o cabeçalho Authorization estiverem ausentes", async () => {
      const mockReq = {
        headers: {},
        cookies: {},
      } as unknown as Request;

      await expect(
        controller.logout(mockReq, mockRes as unknown as Response),
      ).rejects.toThrow(UnauthorizedException);
      await expect(
        controller.logout(mockReq, mockRes as unknown as Response),
      ).rejects.toThrow("Token de autenticação ausente ou inválido");

      expect(logoutUseCaseMock.executar).not.toHaveBeenCalled();
      expect(mockRes.clearCookie).not.toHaveBeenCalled();
    });

    it("deve lançar UnauthorizedException quando o formato do cabeçalho não for Bearer e não houver cookie", async () => {
      const mockReq = {
        headers: {
          authorization: "Basic token-invalido",
        },
      } as unknown as Request;

      await expect(
        controller.logout(mockReq, mockRes as unknown as Response),
      ).rejects.toThrow(UnauthorizedException);
      await expect(
        controller.logout(mockReq, mockRes as unknown as Response),
      ).rejects.toThrow("Token de autenticação ausente ou inválido");

      expect(logoutUseCaseMock.executar).not.toHaveBeenCalled();
    });

    it("deve lançar UnauthorizedException quando o token Bearer for vazio ou apenas espaços e não houver cookie", async () => {
      const mockReq = {
        headers: {
          authorization: "Bearer    ",
        },
      } as unknown as Request;

      await expect(
        controller.logout(mockReq, mockRes as unknown as Response),
      ).rejects.toThrow(UnauthorizedException);
      await expect(
        controller.logout(mockReq, mockRes as unknown as Response),
      ).rejects.toThrow("Token de autenticação ausente ou inválido");

      expect(logoutUseCaseMock.executar).not.toHaveBeenCalled();
    });
  });

  describe("GET /acesso/me", () => {
    it("deve retornar o perfil e dados da sessão contida na request", () => {
      const now = new Date();
      const mockReq = {
        sessao: {
          usuarioId: "user-1",
          municipioId: "muni-1",
          perfilCodigo: "ADMINISTRADOR",
          unidadeIds: ["ubs-1"],
          nomeCompleto: "Carlos Silva",
          email: "carlos@ubs.gov.br",
          deveTrocarSenha: false,
          expiraEm: now,
        },
      } as unknown as Request;

      const res = controller.me(mockReq);

      expect(res).toEqual({
        usuarioId: "user-1",
        municipioId: "muni-1",
        perfilCodigo: "ADMINISTRADOR",
        unidadeIds: ["ubs-1"],
        nomeCompleto: "Carlos Silva",
        email: "carlos@ubs.gov.br",
        deveTrocarSenha: false,
        expiresAt: now.toISOString(),
      });
    });
  });

  describe("POST /acesso/renovar", () => {
    it("deve delegar para RenewSessionUseCase utilizando o id da sessão e atualizar cookie (AC-29)", async () => {
      const mockReq = {
        cookies: { farmaubs_session: "token-renovar-xyz" },
        headers: {},
        sessao: {
          id: "session-1",
        },
      } as unknown as Request;

      renewSessionUseCaseMock.executar.mockResolvedValue({
        expiresAt: "2026-09-23T20:00:00.000Z",
        ttlSeconds: 3600,
        warningSeconds: 300,
      });

      const res = await controller.renovar(
        mockReq,
        mockRes as unknown as Response,
      );

      expect(renewSessionUseCaseMock.executar).toHaveBeenCalledWith("session-1");
      expect(res.ttlSeconds).toBe(3600);
      expect(mockRes.cookie).toHaveBeenCalledWith(
        "farmaubs_session",
        "token-renovar-xyz",
        expect.objectContaining({
          httpOnly: true,
          sameSite: "lax",
          path: "/api/v1",
          maxAge: 3600 * 1000,
        }),
      );
    });
  });

  describe("POST /acesso/trocar-senha", () => {
    const mockReq = {
      sessao: {
        usuarioId: "user-1",
      },
    } as unknown as Request;

    it("deve delegar a troca de senha ao ChangePasswordUseCase e retornar TrocarSenhaResultado", async () => {
      const dto = {
        novaSenha: "NovaSenhaSegura@2026",
        confirmacaoSenha: "NovaSenhaSegura@2026",
      };

      const res = await controller.trocarSenha(mockReq, dto);

      expect(changePasswordUseCaseMock.executar).toHaveBeenCalledWith({
        usuarioId: "user-1",
        novaSenha: "NovaSenhaSegura@2026",
        confirmacaoSenha: "NovaSenhaSegura@2026",
      });
      expect(res).toEqual({
        sucesso: true,
        mensagem: "Senha alterada com sucesso.",
      });
    });

    it("deve converter ConfirmacaoSenhaDivergenteException em BadRequestException", async () => {
      changePasswordUseCaseMock.executar.mockRejectedValueOnce(
        new ConfirmacaoSenhaDivergenteException(),
      );

      await expect(
        controller.trocarSenha(mockReq, {
          novaSenha: "Senha@1",
          confirmacaoSenha: "Senha@2",
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it("deve converter NovaSenhaNaoPodeSerIgualProvisoriaException em BadRequestException", async () => {
      changePasswordUseCaseMock.executar.mockRejectedValueOnce(
        new NovaSenhaNaoPodeSerIgualProvisoriaException(),
      );

      await expect(
        controller.trocarSenha(mockReq, {
          novaSenha: "Provisoria@1",
          confirmacaoSenha: "Provisoria@1",
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it("deve converter SenhaFracaException em BadRequestException", async () => {
      changePasswordUseCaseMock.executar.mockRejectedValueOnce(
        new SenhaFracaException(),
      );

      await expect(
        controller.trocarSenha(mockReq, {
          novaSenha: "123",
          confirmacaoSenha: "123",
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
