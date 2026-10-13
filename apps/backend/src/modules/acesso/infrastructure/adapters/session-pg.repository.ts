import { Injectable } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import { DataSource } from "typeorm";
import * as crypto from "crypto";
import type {
  ISessionRepository,
  CriarSessaoParams,
  RenovarSessaoParams,
  SessaoAutenticada,
} from "../../domain/ports/session.repository.port";

@Injectable()
export class SessionPgRepository implements ISessionRepository {
  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  /**
   * [RF001 / AC-14]: Gera token CSPRNG de 32 bytes e persiste sessao via auth_criar_sessao.
   * @param params - Identificador do usuario, expiracao e metadados de requisicao.
   * @returns Token opaco em hexadecimal para devolucao ao cliente.
   */
  async criarSessao(params: CriarSessaoParams): Promise<string> {
    const token = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    await this.ds.query(
      `SELECT auth_criar_sessao($1::uuid, $2::text, $3::timestamptz, $4::inet, $5::text)`,
      [
        params.usuarioId,
        tokenHash,
        params.expiraEm,
        params.ipOrigem || null,
        params.userAgent || null,
      ]
    );

    return token;
  }

  /**
   * [RF001 / AC-14]: Recupera dados de sessao ativa e contexto agregado via auth_buscar_sessao_por_token.
   * @param tokenHash - Hash SHA-256 do token em formato hexadecimal.
   * @returns SessaoAutenticada com dados de perfil e tenant, ou null se inexistente/invalida.
   */
  async buscarPorTokenHash(tokenHash: string): Promise<SessaoAutenticada | null> {
    const rows = await this.ds.query<any[]>(
      `SELECT * FROM auth_buscar_sessao_por_token($1::text)`,
      [tokenHash],
    );
    if (!rows[0]) return null;
    const r = rows[0];
    return {
      id: r.id,
      usuarioId: r.usuario_id,
      municipioId: r.municipio_id,
      perfilCodigo: r.perfil_codigo,
      unidadeIds: r.unidade_ids ?? [],
      nomeCompleto: r.nome_completo,
      email: r.email,
      deveTrocarSenha: r.deve_trocar_senha,
      status: r.status,
      expiraEm: new Date(r.expira_em),
      criadoEm: new Date(r.criado_em),
      ultimaAtividadeEm: new Date(r.ultima_atividade_em),
    };
  }

  /**
   * [RF001 / AC-14]: Atualiza ultima atividade e estende validade via auth_renovar_sessao.
   * @param params - Identificador UUID da sessao e novo horario de expiracao.
   */
  async renovarAtividade(params: RenovarSessaoParams): Promise<void> {
    await this.ds.query(`SELECT auth_renovar_sessao($1, $2)`, [
      params.sessionId,
      params.expiraEm,
    ]);
  }

  /**
   * [RF001 / AC-14]: Revoga sessao individual marcando status revogada via auth_revogar_sessao.
   * @param sessionId - Identificador UUID da sessao a ser revogada.
   */
  async revogar(sessionId: string): Promise<void> {
    await this.ds.query(`SELECT auth_revogar_sessao($1)`, [sessionId]);
  }

  /**
   * [RF001 / AC-14]: Revoga todas as sessoes ativas do usuario via auth_revogar_todas_sessoes.
   * @param usuarioId - Identificador UUID do usuario alvo.
   */
  async revogarTodas(usuarioId: string): Promise<void> {
    await this.ds.query(`SELECT auth_revogar_todas_sessoes($1)`, [usuarioId]);
  }

  /**
   * [RF001 / AC-14]: Remove sessoes expiradas alem da janela de retencao via auth_limpar_sessoes_expiradas.
   * @param diasRetencao - Dias de retencao historica (default: 7 dias).
   * @returns Quantidade de registros purgados pelo procedimento.
   */
  async limparExpiradas(diasRetencao: number = 7): Promise<number> {
    const rows = await this.ds.query(
      `SELECT auth_limpar_sessoes_expiradas($1::int) AS total`,
      [diasRetencao]
    );
    return parseInt(rows?.[0]?.total ?? "0", 10);
  }
}
