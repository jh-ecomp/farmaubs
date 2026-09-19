import type { UsuarioPayload } from "../types/auth";

/**
 * Retorna a rota inicial padrão do usuário de acordo com o perfil de acesso (RBAC).
 * Administrador -> /admin/usuarios
 * Demais perfis (Farmacêutico, Gestor, etc.) -> /em-desenvolvimento
 */
export function getDefaultRouteForUser(
  usuario?: UsuarioPayload | null,
): string {
  if (!usuario) return "/login";

  const perfilCodigo = (usuario.perfilCodigo ?? "").toUpperCase();
  const isAdmin = perfilCodigo === "ADMINISTRADOR";

  if (isAdmin) {
    return "/admin/usuarios";
  }

  return "/em-desenvolvimento";
}
