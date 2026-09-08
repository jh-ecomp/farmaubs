import { PerfilModeloDominio } from '../models/user-registration.model';

export const REPOSITORIO_PERFIL_PORT = Symbol('REPOSITORIO_PERFIL_PORT');
export const PROFILE_REPOSITORY_PORT = REPOSITORIO_PERFIL_PORT;

export interface RepositorioPerfilPort {
  buscarPorId(id: string): Promise<PerfilModeloDominio | null>;
  buscarPorCodigoOuNome(
    identificador: string,
  ): Promise<PerfilModeloDominio | null>;
}

export type ProfileRepositoryPort = RepositorioPerfilPort;
