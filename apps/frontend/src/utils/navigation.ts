import { PerfilCodigo } from "@farmaubs/shared";
import type { UsuarioPayload } from "../types/auth";

/**
 * [RF002 / RBAC]: Retorna a rota inicial padrão do usuário de acordo com o perfil de acesso (RBAC).
 * - Administrador -> /usuarios
 * - Farmacêuticos (Responsável / Residente) e Gerente -> /dispensas
 * - Demais cenários / fallback -> /dashboard
 * @param usuario - Objeto do usuário autenticado no contexto global.
 * @returns Rota padrão para redirecionamento após autenticação.
 */
export function getDefaultRouteForUser(
  usuario?: UsuarioPayload | null,
): string {
  if (!usuario) return "/login";

  const perfilCodigo = usuario.perfilCodigo
    ? String(usuario.perfilCodigo).toUpperCase()
    : "";
  const rawPerfil = usuario.perfil as unknown;
  const perfis = Array.isArray(rawPerfil)
    ? rawPerfil.map((p) => String(p).toUpperCase())
    : typeof rawPerfil === "string" && rawPerfil.length > 0
      ? [rawPerfil.toUpperCase()]
      : [];

  const temPerfil = (codigo: string) =>
    perfilCodigo === codigo || perfis.includes(codigo);

  if (temPerfil(PerfilCodigo.ADMINISTRADOR) || temPerfil("ADMIN")) {
    return "/usuarios";
  }

  if (
    temPerfil(PerfilCodigo.FARMACEUTICO_RESPONSAVEL) ||
    temPerfil(PerfilCodigo.FARMACEUTICO_RESIDENTE) ||
    temPerfil(PerfilCodigo.GERENTE) ||
    temPerfil("GESTOR")
  ) {
    return "/dispensas";
  }

  return "/dashboard";
}
