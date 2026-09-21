import type { MunicipioDto } from "@farmaubs/shared";

export const REPOSITORIO_MUNICIPIO_PORT = Symbol("REPOSITORIO_MUNICIPIO_PORT");

export interface RepositorioMunicipioPort {
  listarAtivos(): Promise<MunicipioDto[]>;
}
