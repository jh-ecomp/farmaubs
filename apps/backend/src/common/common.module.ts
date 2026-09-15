import { Global, Module } from "@nestjs/common";
import { TenantContextService } from "./tenant/tenant-context.service";
import { TransactionContext } from "./transaction/transaction-context.service";

@Global()
@Module({
  providers: [TenantContextService, TransactionContext],
  exports: [TenantContextService, TransactionContext],
})
export class CommonModule {}
