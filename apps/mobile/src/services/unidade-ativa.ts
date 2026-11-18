export type UnidadeResumo = {
  id: string;
  nome: string;
};

/**
 * [AC-MOB-03]: Cruza o catálogo da API com as unidades do login.
 * @param catalogo - Itens com id e nome.
 * @param idsAutorizados - usuario.unidadeIds.
 * @returns Só as UBS que o usuário pode usar.
 */
export function unidadesAutorizadas(
  catalogo: UnidadeResumo[],
  idsAutorizados: string[],
): UnidadeResumo[] {
  const permitidos = new Set(idsAutorizados);
  return catalogo.filter((unidade) => permitidos.has(unidade.id));
}

/**
 * [AC-MOB-03]: Uma unidade vira a ativa. Várias usam a última salva, se ainda estiver na lista.
 * @param ids - Unidades autorizadas, na ordem do login.
 * @param salvaId - Última escolha gravada no aparelho.
 * @returns Id ativo, ou null se o usuário não tem UBS.
 */
export function escolherIdUnidade(ids: string[], salvaId: string | null): string | null {
  if (ids.length === 0) return null;
  if (salvaId && ids.includes(salvaId)) return salvaId;
  return ids[0];
}

/**
 * [AC-MOB-03]: Com uma UBS o topo é texto. Com duas ou mais, abre o seletor.
 * @param quantidade - Tamanho da lista autorizada.
 * @returns True quando o toque pode trocar a unidade.
 */
export function podeAlternarUnidade(quantidade: number): boolean {
  return quantidade > 1;
}

/**
 * [AC-MOB-03]: Texto do aviso depois da troca.
 * @param nome - Nome da UBS escolhida.
 * @returns Frase exibida no topo.
 */
export function mensagemUnidadeAlterada(nome: string): string {
  return `Unidade alterada para ${nome}`;
}

/**
 * [AC-MOB-03]: Lê o JSON da API ou do aparelho e descarta item sem id ou sem nome.
 * @param data - Corpo já interpretado.
 * @returns Lista utilizável.
 */
export function lerCatalogoUnidades(data: unknown): UnidadeResumo[] {
  if (!Array.isArray(data)) return [];
  return data.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const unidade = item as { id?: unknown; nome?: unknown };
    if (typeof unidade.id !== "string" || !unidade.id) return [];
    if (typeof unidade.nome !== "string" || !unidade.nome) return [];
    return [{ id: unidade.id, nome: unidade.nome }];
  });
}

/**
 * [AC-MOB-03]: Acrescenta o tenant sem apagar Authorization.
 * @param unidadeId - UUID da UBS ativa.
 * @param headers - Headers já definidos pelo chamador.
 * @returns Headers com x-unidade-id.
 */
export function comUnidade(unidadeId: string, headers?: HeadersInit): Record<string, string> {
  return {
    ...(headers as Record<string, string> | undefined),
    "x-unidade-id": unidadeId,
  };
}
