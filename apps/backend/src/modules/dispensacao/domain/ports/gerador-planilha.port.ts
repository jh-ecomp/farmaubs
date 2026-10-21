import type { LinhaExportacaoDispensacaoDto } from "@farmaubs/shared";

export interface GeradorPlanilhaPort {
  gerarXlsx(linhas: LinhaExportacaoDispensacaoDto[]): Promise<Buffer>;
}

export const GERADOR_PLANILHA_PORT = Symbol("GERADOR_PLANILHA_PORT");

