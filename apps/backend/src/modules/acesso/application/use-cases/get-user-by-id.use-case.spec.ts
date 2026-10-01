import { GetUserByIdUseCase } from "./get-user-by-id.use-case";
import type { RepositorioUsuarioPort } from "../../domain/ports/user.repository.port";
import { UsuarioNaoEncontradoException } from "../../domain/errors/user-management.errors";
import type { UsuarioDetalheDto } from "@farmaubs/shared";

describe("GetUserByIdUseCase", () => {
  let useCase: GetUserByIdUseCase;
  let usuarioRepoMock: jest.Mocked<RepositorioUsuarioPort>;

  const mockUsuarioDetalhe: UsuarioDetalheDto = {
    id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
    nomeCompleto: "Carlos Eduardo da Silva",
    email: "carlos.silva@ubs.gov.br",
    ativo: true,
    deveTrocarSenha: false,
    municipio: {
      id: "01919a77-3e15-7000-8000-000000000001",
      nome: "Santos",
      uf: "SP",
    },
    perfil: {
      id: "01919a77-3e15-7000-8000-000000000002",
      codigo: "ADMINISTRADOR",
      nome: "Administrador",
    },
    unidadesSaude: [
      {
        id: "01919a77-3e15-7000-8000-000000000010",
        cnes: "2401824",
        nome: "UBS Central Santos",
        ativo: true,
      },
      {
        id: "01919a77-3e15-7000-8000-000000000011",
        cnes: "2401832",
        nome: "UBS Gonzaga",
        ativo: true,
      },
    ],
    ultimoLoginEm: new Date("2026-09-24T12:00:00Z"),
    criadoEm: new Date("2026-09-10T10:00:00Z"),
    atualizadoEm: new Date("2026-09-24T12:00:00Z"),
  };

  beforeEach(() => {
    usuarioRepoMock = {
      buscarDetalhesPorId: jest.fn(),
    } as unknown as jest.Mocked<RepositorioUsuarioPort>;

    useCase = new GetUserByIdUseCase(usuarioRepoMock);
  });

  it("deve retornar detalhes completos do usuário por ID com sucesso", async () => {
    usuarioRepoMock.buscarDetalhesPorId.mockResolvedValue(mockUsuarioDetalhe);

    const resultado = await useCase.executar(
      "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
    );

    expect(usuarioRepoMock.buscarDetalhesPorId).toHaveBeenCalledWith(
      "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
    );
    expect(resultado).toEqual(mockUsuarioDetalhe);
    expect(resultado.unidadesSaude).toHaveLength(2);
    expect((resultado as any).senha_hash).toBeUndefined();
    expect((resultado as any).senhaHash).toBeUndefined();
    expect((resultado as any).password_hash).toBeUndefined();
  });

  it("deve lançar UsuarioNaoEncontradoException quando o usuário não existir", async () => {
    usuarioRepoMock.buscarDetalhesPorId.mockResolvedValue(null);

    await expect(
      useCase.executar("b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22"),
    ).rejects.toThrow(UsuarioNaoEncontradoException);

    expect(usuarioRepoMock.buscarDetalhesPorId).toHaveBeenCalledWith(
      "b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22",
    );
  });

  it("deve lançar UsuarioNaoEncontradoException para ID vazio ou em branco", async () => {
    await expect(useCase.executar("   ")).rejects.toThrow(
      UsuarioNaoEncontradoException,
    );
    expect(usuarioRepoMock.buscarDetalhesPorId).not.toHaveBeenCalled();
  });
});
