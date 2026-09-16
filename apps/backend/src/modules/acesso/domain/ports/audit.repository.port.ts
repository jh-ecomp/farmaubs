import type { EventoAuditoria } from "@farmaubs/shared";

export const AUDIT_REPOSITORY_PORT = Symbol("AUDIT_REPOSITORY_PORT");

export interface AuditRepositoryPort {
  registrar(evento: EventoAuditoria): Promise<void>;
}
