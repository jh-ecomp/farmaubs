import { Injectable } from "@nestjs/common";
import type { EventoAuditoria } from "@farmaubs/shared";
import { AuditRepositoryPort } from "../../domain/ports/audit.repository.port";
import { TransactionContext } from "../../../../common/transaction/transaction-context.service";
import { AuditLogEntity } from "../persistence/entities/audit-log.entity";

@Injectable()
export class TypeOrmAuditRepository implements AuditRepositoryPort {
  constructor(private readonly transactionContext: TransactionContext) {}

  async registrar(evento: EventoAuditoria): Promise<void> {
    const manager = this.transactionContext.getManager();
    const entity = manager.create(AuditLogEntity, {
      id: evento.id,
      usuarioExecutorId: evento.usuarioExecutorId,
      usuarioAlvoId: evento.usuarioAlvoId,
      tipoOperacao: evento.tipoOperacao,
      detalhes: evento.detalhes,
      createdAt: evento.createdAt,
    });
    await manager.save(AuditLogEntity, entity);
  }
}
