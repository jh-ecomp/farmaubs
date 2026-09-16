import { Inject, Injectable } from "@nestjs/common";
import type {
  ListagemUsuariosFiltros,
  ListagemUsuariosResultado,
} from "@farmaubs/shared";
import {
  REPOSITORIO_USUARIO_PORT,
  type RepositorioUsuarioPort,
} from "../../domain/ports/user.repository.port";

@Injectable()
export class ListUsersUseCase {
  constructor(
    @Inject(REPOSITORIO_USUARIO_PORT)
    private readonly usuarioRepo: RepositorioUsuarioPort,
  ) {}

  async executar(
    filtros: ListagemUsuariosFiltros = {},
  ): Promise<ListagemUsuariosResultado> {
    const rawPage = filtros.page !== undefined ? Number(filtros.page) : 1;
    const rawLimit = filtros.limit !== undefined ? Number(filtros.limit) : 10;

    const page =
      !Number.isNaN(rawPage) && rawPage >= 1 ? Math.floor(rawPage) : 1;
    const limit =
      !Number.isNaN(rawLimit) && rawLimit >= 1
        ? Math.min(Math.floor(rawLimit), 100)
        : 10;

    const busca = filtros.busca?.trim() || undefined;
    const municipioId = filtros.municipioId?.trim() || undefined;
    const perfilId = filtros.perfilId?.trim() || undefined;
    const status = filtros.status?.trim() || undefined;

    return this.usuarioRepo.listar({
      page,
      limit,
      busca,
      municipioId,
      perfilId,
      status,
    });
  }
}

export type ListarUsuariosUseCase = ListUsersUseCase;
