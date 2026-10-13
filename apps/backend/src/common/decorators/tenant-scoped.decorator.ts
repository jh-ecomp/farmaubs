import { SetMetadata } from "@nestjs/common";

export const TENANT_SCOPED_KEY = "tenantScopeOptions";

export interface TenantScopeOptions {
  checkUbs?: boolean;
  paramName?: string;
}

/**
 * [RF001 / ADR-002 / AC-13]: Configura checagem estrita de escopo territorial municipal e de UBSs.
 * @param options - Opções de validação de escopo territorial ({ checkUbs, paramName }).
 * @returns Custom decorator do NestJS com metadados de tenant scope.
 */
export const TenantScoped = (
  options: TenantScopeOptions = { checkUbs: false },
) => SetMetadata(TENANT_SCOPED_KEY, options);

