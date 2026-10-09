import { SetMetadata } from "@nestjs/common";
import { PerfilCodigo } from "@farmaubs/shared";

export const ROLES_KEY = "roles";
export const Roles = (...roles: (PerfilCodigo | string)[]) =>
  SetMetadata(ROLES_KEY, roles);
