import {
  DadosCriacaoUsuario,
  UsuarioModeloDominio,
} from "../entities/user-registration.entity";
import type {
  ListagemUsuariosFiltros,
  ListagemUsuariosResultado,
} from "@farmaubs/shared";

export const REPOSITORIO_USUARIO_PORT = Symbol("REPOSITORIO_USUARIO_PORT");
export const USER_REPOSITORY_PORT = REPOSITORIO_USUARIO_PORT;

export interface RepositorioUsuarioPort {
  buscarPorEmail(email: string): Promise<UsuarioModeloDominio | null>;
  existePorEmail(email: string): Promise<boolean>;
  salvar(
    dadosUsuario: DadosCriacaoUsuario,
    ubsIds: string[],
  ): Promise<UsuarioModeloDominio>;
  listar(filtros: ListagemUsuariosFiltros): Promise<ListagemUsuariosResultado>;
}

export type UserRepositoryPort = RepositorioUsuarioPort;
