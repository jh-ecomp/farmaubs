import type { UsuarioPayload } from "../types/auth";

/**
 * [RF002 / RBAC]: Retorna a rota inicial padrão do usuário de acordo com o perfil de acesso (RBAC).
 * Administrador -> /admin/usuarios
 * Demais perfis (Farmacêutico, Gestor, etc.) -> /em-desenvolvimento
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

  const isAdmin =
    perfilCodigo === "ADMINISTRADOR" ||
    perfilCodigo === "ADMIN" ||
    perfis.some((p) => p === "ADMINISTRADOR" || p === "ADMIN");

  if (isAdmin) {
    return "/admin/usuarios";
  }

  return "/em-desenvolvimento";
}
