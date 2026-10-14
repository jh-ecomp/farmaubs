export enum PerfilCodigo {
  ADMINISTRADOR = "ADMINISTRADOR",
  GERENTE = "GERENTE",
  FARMACEUTICO_RESPONSAVEL = "FARMACEUTICO_RESPONSAVEL",
  FARMACEUTICO_RESIDENTE = "FARMACEUTICO_RESIDENTE",
}

export interface PerfilDto {
  id: string;
  codigo: PerfilCodigo;
  nome: string;
  descricao?: string | null;
  ativo: boolean;
}

/**
 * [NF009 / RBAC]: Matriz declarativa de rotas e perfis autorizados (Sincronizada com AC-13).
 */
export const MATRIZ_PERMISSOES_ROTAS: Record<string, PerfilCodigo[]> = {
  "/dashboard": [
    PerfilCodigo.FARMACEUTICO_RESIDENTE,
    PerfilCodigo.FARMACEUTICO_RESPONSAVEL,
    PerfilCodigo.GERENTE,
    PerfilCodigo.ADMINISTRADOR,
  ],
  "/estoque": [
    PerfilCodigo.FARMACEUTICO_RESIDENTE,
    PerfilCodigo.FARMACEUTICO_RESPONSAVEL,
    PerfilCodigo.GERENTE,
    PerfilCodigo.ADMINISTRADOR,
  ],
  "/dispensas": [
    PerfilCodigo.FARMACEUTICO_RESIDENTE,
    PerfilCodigo.FARMACEUTICO_RESPONSAVEL,
    PerfilCodigo.GERENTE,
    PerfilCodigo.ADMINISTRADOR,
  ],
  "/indicadores": [
    PerfilCodigo.FARMACEUTICO_RESIDENTE,
    PerfilCodigo.FARMACEUTICO_RESPONSAVEL,
    PerfilCodigo.GERENTE,
    PerfilCodigo.ADMINISTRADOR,
  ],
  "/relatorios": [
    PerfilCodigo.FARMACEUTICO_RESPONSAVEL,
    PerfilCodigo.GERENTE,
    PerfilCodigo.ADMINISTRADOR,
  ],
  "/log-auditoria": [
    PerfilCodigo.GERENTE,
    PerfilCodigo.ADMINISTRADOR,
  ],
  "/usuarios": [
    PerfilCodigo.ADMINISTRADOR,
  ],
  "/ubs": [
    PerfilCodigo.ADMINISTRADOR,
  ],
  "/parametros": [
    PerfilCodigo.FARMACEUTICO_RESPONSAVEL,
    PerfilCodigo.ADMINISTRADOR,
  ],
  "/403": [
    PerfilCodigo.FARMACEUTICO_RESIDENTE,
    PerfilCodigo.FARMACEUTICO_RESPONSAVEL,
    PerfilCodigo.GERENTE,
    PerfilCodigo.ADMINISTRADOR,
  ],
};

/**
 * [NF009 / RBAC]: Valida se o perfil do usuário possui autorização para a lista de papéis permitidos.
 * @param perfilUsuario - Código do perfil do usuário ou array de perfis.
 * @param perfisPermitidos - Lista de perfis autorizados.
 * @returns Verdadeiro caso o usuário possua ao menos um dos perfis exigidos.
 */
export function verificarPerfilPermitido(
  perfilUsuario: PerfilCodigo | string | (PerfilCodigo | string)[] | undefined | null,
  perfisPermitidos: (PerfilCodigo | string)[],
): boolean {
  if (!perfilUsuario || !perfisPermitidos || perfisPermitidos.length === 0) {
    return false;
  }

  const perfisUsuarioArr = Array.isArray(perfilUsuario)
    ? perfilUsuario.map((p) => String(p).toUpperCase())
    : [String(perfilUsuario).toUpperCase()];

  const permitidosNormalizados = perfisPermitidos.map((p) =>
    String(p).toUpperCase(),
  );

  return perfisUsuarioArr.some((p) => {
    // Normalização para equivalência de ADMIN / ADMINISTRADOR e GESTOR / GERENTE se necessário
    if (p === "ADMIN" && permitidosNormalizados.includes("ADMINISTRADOR")) return true;
    if (p === "ADMINISTRADOR" && permitidosNormalizados.includes("ADMIN")) return true;
    if (p === "GESTOR" && permitidosNormalizados.includes("GERENTE")) return true;
    if (p === "GERENTE" && permitidosNormalizados.includes("GESTOR")) return true;
    return permitidosNormalizados.includes(p);
  });
}

/**
 * [NF009 / RBAC]: Valida se o perfil do usuário possui acesso a um recurso/rota mapeado na matriz.
 * @param perfilUsuario - Código do perfil do usuário ou array de perfis.
 * @param rota - Caminho da rota ou identificador do recurso.
 * @returns Verdadeiro caso a rota seja pública, não esteja restrita ou o perfil seja autorizado.
 */
export function podeAcessarRecurso(
  perfilUsuario: PerfilCodigo | string | (PerfilCodigo | string)[] | undefined | null,
  rota: string,
): boolean {
  const perfisAutorizados = MATRIZ_PERMISSOES_ROTAS[rota];
  if (!perfisAutorizados) {
    return true; // Rota não restrita na matriz
  }
  return verificarPerfilPermitido(perfilUsuario, perfisAutorizados);
}

