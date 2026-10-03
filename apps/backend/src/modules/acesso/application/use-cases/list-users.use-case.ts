import type {
  ListagemUsuariosFiltros,
  ListagemUsuariosResultado,
  PerfilCodigo,
} from "@farmaubs/shared";
import {
  type RepositorioUsuarioPort,
} from "../../domain/ports/user.repository.port";

export class ListUsersUseCase {
  constructor(
    private readonly usuarioRepo: RepositorioUsuarioPort,
  ) {}

  /**
   * [RF025 / Listagem de Usuários]: Lista usuários com paginação canônica e filtros combinados.
   * @param filtros - Filtros opcionais de paginação, busca textual, município, perfil e status.
   * @returns Envelope paginado contendo a lista de usuários e totais calculados.
   */
  async executar(
    filtros: ListagemUsuariosFiltros = {},
  ): Promise<ListagemUsuariosResultado> {
    const rawPage =
      filtros.pagina !== undefined
        ? Number(filtros.pagina)
        : filtros.page !== undefined
          ? Number(filtros.page)
          : 1;

    const rawLimit =
      filtros.limite !== undefined
        ? Number(filtros.limite)
        : filtros.limit !== undefined
          ? Number(filtros.limit)
          : 10;

    const page =
      !Number.isNaN(rawPage) && rawPage >= 1 ? Math.floor(rawPage) : 1;
    const limit =
      !Number.isNaN(rawLimit) && rawLimit >= 1
        ? Math.min(Math.floor(rawLimit), 100)
        : 10;

    const busca = (filtros.termoBusca ?? filtros.busca)?.trim() || undefined;
    const municipioId = filtros.municipioId?.trim() || undefined;
    const perfilId =
      (filtros.perfilCodigo ?? filtros.perfilId)?.trim() || undefined;
    let status = filtros.status?.trim() || undefined;
    if (filtros.ativo !== undefined) {
      status = filtros.ativo ? "ATIVO" : "INATIVO";
    }

    return this.usuarioRepo.listar({
      page,
      limit,
      busca,
      municipioId,
      perfilId,
      status,
      pagina: page,
      limite: limit,
      termoBusca: busca,
      perfilCodigo: perfilId ? (perfilId as PerfilCodigo) : undefined,
      ativo: filtros.ativo,
    });
  }
}

export type ListarUsuariosUseCase = ListUsersUseCase;
