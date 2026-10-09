import { SetMetadata } from "@nestjs/common";

export const TENANT_SCOPED_KEY = "tenantScopeOptions";

export interface TenantScopeOptions {
  checkUbs?: boolean;
  paramName?: string;
}

export const TenantScoped = (
  options: TenantScopeOptions = { checkUbs: false },
) => SetMetadata(TENANT_SCOPED_KEY, options);
