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
  buscarPorId(id: string): Promise<UsuarioModeloDominio | null>;
  buscarUbsIds(usuarioId: string): Promise<string[]>;
  existePorEmail(email: string): Promise<boolean>;
  salvar(
    dadosUsuario: DadosCriacaoUsuario,
    ubsIds: string[],
  ): Promise<UsuarioModeloDominio>;
  listar(filtros: ListagemUsuariosFiltros): Promise<ListagemUsuariosResultado>;
  atualizarDados(
    id: string,
    dados: { nomeCompleto?: string; email?: string },
  ): Promise<UsuarioModeloDominio>;
  atualizarPerfilEUbs(
    usuarioId: string,
    perfilId: string,
    ubsIds: string[],
  ): Promise<void>;
  atualizarStatus(id: string, ativo: boolean): Promise<UsuarioModeloDominio>;
  atualizarSenhaProvisoria(id: string, senhaHash: string): Promise<void>;
  contarAdministradoresAtivos(): Promise<number>;
  buscarSenhaHashPorId(id: string): Promise<string | null>;
  concluirTrocaDeSenha(
    id: string,
    senhaHash: string,
    atualizadoEm: Date,
  ): Promise<void>;
}

export type UserRepositoryPort = RepositorioUsuarioPort;
