import { SetMetadata } from "@nestjs/common";
import { PerfilCodigo } from "@farmaubs/shared";

export const ROLES_KEY = "roles";

/**
 * [RF025 / AC-13]: Declara os perfis de acesso autorizados a executar o controller ou rota (RBAC).
 * @param roles - Lista de perfis permitidos (PerfilCodigo).
 * @returns Custom decorator do NestJS com metadados de roles.
 */
export const Roles = (...roles: (PerfilCodigo | string)[]) =>
  SetMetadata(ROLES_KEY, roles);

