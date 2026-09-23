import { Test, TestingModule } from "@nestjs/testing";
import { UnauthorizedException } from "@nestjs/common";
import type { Request } from "express";
import { AcessoController } from "./acesso.controller";
import { LoginUseCase } from "../../application/use-cases/login.use-case";
import { RenewSessionUseCase } from "../../application/use-cases/renew-session.use-case";
import { LogoutUseCase } from "../../application/use-cases/logout.use-case";

describe("AcessoController (Camada A — Teste Unitário)", () => {
  let controller: AcessoController;
  let loginUseCaseMock: jest.Mocked<LoginUseCase>;
  let renewSessionUseCaseMock: jest.Mocked<RenewSessionUseCase>;
  let logoutUseCaseMock: jest.Mocked<LogoutUseCase>;

  beforeEach(async () => {
    loginUseCaseMock = {
      executar: jest.fn(),
    } as unknown as jest.Mocked<LoginUseCase>;

    renewSessionUseCaseMock = {
      executar: jest.fn(),
    } as unknown as jest.Mocked<RenewSessionUseCase>;

    logoutUseCaseMock = {
      executar: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<LogoutUseCase>;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AcessoController],
      providers: [
        { provide: LoginUseCase, useValue: loginUseCaseMock },
        { provide: RenewSessionUseCase, useValue: renewSessionUseCaseMock },
        { provide: LogoutUseCase, useValue: logoutUseCaseMock },
      ],
    }).compile();

    controller = module.get<AcessoController>(AcessoController);
  });

  describe("POST /acesso/logout", () => {
    it("deve delegar a revogação ao LogoutUseCase quando o cabeçalho Authorization for válido", async () => {
      const mockReq = {
        headers: {
          authorization: "Bearer token-secreto-12345",
        },
      } as unknown as Request;

      await expect(controller.logout(mockReq)).resolves.toBeUndefined();

      expect(logoutUseCaseMock.executar).toHaveBeenCalledTimes(1);
      expect(logoutUseCaseMock.executar).toHaveBeenCalledWith(
        "token-secreto-12345",
      );
    });

    it("deve lançar UnauthorizedException quando o cabeçalho Authorization estiver ausente", async () => {
      const mockReq = {
        headers: {},
      } as unknown as Request;

      await expect(controller.logout(mockReq)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(controller.logout(mockReq)).rejects.toThrow(
        "Token de autenticação ausente ou inválido",
      );

      expect(logoutUseCaseMock.executar).not.toHaveBeenCalled();
    });

    it("deve lançar UnauthorizedException quando o formato não for Bearer", async () => {
      const mockReq = {
        headers: {
          authorization: "Basic token-invalido",
        },
      } as unknown as Request;

      await expect(controller.logout(mockReq)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(controller.logout(mockReq)).rejects.toThrow(
        "Token de autenticação ausente ou inválido",
      );

      expect(logoutUseCaseMock.executar).not.toHaveBeenCalled();
    });

    it("deve lançar UnauthorizedException quando o token Bearer for vazio ou apenas espaços", async () => {
      const mockReq = {
        headers: {
          authorization: "Bearer    ",
        },
      } as unknown as Request;

      await expect(controller.logout(mockReq)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(controller.logout(mockReq)).rejects.toThrow(
        "Token de autenticação ausente ou inválido",
      );

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
    it("deve delegar para RenewSessionUseCase utilizando o id da sessão", async () => {
      const mockReq = {
        sessao: {
          id: "session-1",
        },
      } as unknown as Request;

      renewSessionUseCaseMock.executar.mockResolvedValue({
        expiresAt: "2026-09-23T20:00:00.000Z",
        ttlSeconds: 3600,
        warningSeconds: 300,
      });

      const res = await controller.renovar(mockReq);

      expect(renewSessionUseCaseMock.executar).toHaveBeenCalledWith("session-1");
      expect(res.ttlSeconds).toBe(3600);
    });
  });
});
