import { Inject, Injectable } from "@nestjs/common";
import type { UsuarioDetalheDto } from "@farmaubs/shared";
import {
  REPOSITORIO_USUARIO_PORT,
  type RepositorioUsuarioPort,
} from "../../domain/ports/user.repository.port";
import { UsuarioNaoEncontradoException } from "../../domain/errors/user-management.errors";

@Injectable()
export class GetUserByIdUseCase {
  constructor(
    @Inject(REPOSITORIO_USUARIO_PORT)
    private readonly usuarioRepo: RepositorioUsuarioPort,
  ) {}

  /**
   * [RF025 / Detalhe de Usuário]: Consulta os detalhes cadastrais completos de um usuário por ID com suas UBSs vinculadas.
   * @param id - Identificador único UUID do usuário consultado.
   * @returns Detalhes cadastrais completos do usuário e lista de UBSs associadas.
   * @throws {UsuarioNaoEncontradoException} Quando o usuário não for encontrado no repositório.
   */
  async executar(id: string): Promise<UsuarioDetalheDto> {
    const usuarioId = id?.trim();
    if (!usuarioId) {
      throw new UsuarioNaoEncontradoException(id);
    }

    const usuario = await this.usuarioRepo.buscarDetalhesPorId(usuarioId);
    if (!usuario) {
      throw new UsuarioNaoEncontradoException(usuarioId);
    }

    return usuario;
  }
}

export type ObterUsuarioPorIdUseCase = GetUserByIdUseCase;
