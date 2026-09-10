import * as crypto from "crypto";
import { Injectable } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import { DataSource } from "typeorm";
import type {
  IAcessoRepository,
  UserAcessoRecord,
  CreateSessionParams,
} from "../../domain/ports/acesso.repository.port";

@Injectable()
export class AcessoPgRepository implements IAcessoRepository {
  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  async buscarUsuarioPorEmail(email: string): Promise<UserAcessoRecord | null> {
    const rows = await this.ds.query<any[]>(
      `SELECT * FROM auth_buscar_usuario_por_email($1)`,
      [email],
    );
    if (!rows[0]) return null;
    const r = rows[0];
    return {
      id: r.id,
      municipioId: r.municipio_id,
      email: r.email,
      senhaHash: r.senha_hash,
      ativo: r.ativo,
      tentativasLoginFalhas: r.tentativas_login_falhas,
      bloqueadoAte: r.bloqueado_ate ? new Date(r.bloqueado_ate) : null,
    };
  }

  async registrarFalhaLogin(usuarioId: string): Promise<void> {
    await this.ds.query(`SELECT auth_registrar_falha_login($1)`, [usuarioId]);
  }

  async resetarEstadoLogin(usuarioId: string): Promise<void> {
    await this.ds.query(`SELECT auth_resetar_estado_login($1)`, [usuarioId]);
  }

  async criarSessao(params: CreateSessionParams): Promise<string> {
    const tokenPlain = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto
      .createHash("sha256")
      .update(tokenPlain)
      .digest("hex");

    await this.ds.query(`SELECT auth_criar_sessao($1, $2, $3, $4::inet, $5)`, [
      params.usuarioId,
      tokenHash,
      params.expiraEm,
      params.ipOrigem ?? null,
      params.userAgent ?? null,
    ]);

    return tokenPlain;
  }
}
