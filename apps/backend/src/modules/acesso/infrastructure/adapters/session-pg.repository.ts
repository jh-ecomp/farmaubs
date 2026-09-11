import { Injectable } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import { DataSource } from "typeorm";
import type {
  ISessionRepository,
  SessionRecord,
  RenovarSessaoParams,
} from "../../domain/ports/session.repository.port";

@Injectable()
export class SessionPgRepository implements ISessionRepository {
  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  async buscarPorTokenHash(tokenHash: string): Promise<SessionRecord | null> {
    const rows = await this.ds.query<any[]>(
      `SELECT * FROM auth_buscar_sessao_por_token($1)`,
      [tokenHash],
    );
    if (!rows[0]) return null;
    const r = rows[0];
    return {
      id: r.id,
      usuarioId: r.usuario_id,
      municipioId: r.municipio_id,
      status: r.status,
      expiraEm: new Date(r.expira_em),
      criadoEm: new Date(r.criado_em),
    };
  }

  async renovarAtividade(params: RenovarSessaoParams): Promise<void> {
    await this.ds.query(`SELECT auth_renovar_sessao($1, $2)`, [
      params.sessionId,
      params.expiraEm,
    ]);
  }

  async revogar(sessionId: string): Promise<void> {
    await this.ds.query(`SELECT auth_revogar_sessao($1)`, [sessionId]);
  }

  async revogarTodas(usuarioId: string): Promise<void> {
    await this.ds.query(`SELECT auth_revogar_todas_sessoes($1)`, [usuarioId]);
  }
}
