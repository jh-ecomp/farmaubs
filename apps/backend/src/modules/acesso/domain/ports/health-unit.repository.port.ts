export const REPOSITORIO_UNIDADE_SAUDE_PORT = Symbol(
  'REPOSITORIO_UNIDADE_SAUDE_PORT',
);
export const HEALTH_UNIT_REPOSITORY_PORT = REPOSITORIO_UNIDADE_SAUDE_PORT;

export interface RepositorioUnidadeSaudePort {
  buscarIdsExistentes(
    unidadesIds: string[],
    municipioId?: string,
  ): Promise<string[]>;
}

export type HealthUnitRepositoryPort = RepositorioUnidadeSaudePort;
