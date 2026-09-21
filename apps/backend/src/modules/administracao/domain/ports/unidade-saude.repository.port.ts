import type { UnidadeSaudeDto } from "@farmaubs/shared";

export const REPOSITORIO_UNIDADE_SAUDE_PORT = Symbol(
  "REPOSITORIO_UNIDADE_SAUDE_PORT",
);

export interface RepositorioUnidadeSaudePort {
  buscarPorMunicipio(municipioId: string): Promise<UnidadeSaudeDto[]>;
}
