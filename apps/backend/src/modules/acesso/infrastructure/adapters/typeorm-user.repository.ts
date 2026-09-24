import { Injectable } from "@nestjs/common";
import { EntityManager } from "typeorm";
import { randomUUID } from "node:crypto";
import { RepositorioUsuarioPort } from "../../domain/ports/user.repository.port";
import {
  DadosCriacaoUsuario,
  UsuarioModeloDominio,
} from "../../domain/entities/user-registration.entity";
import type {
  ListagemUsuariosFiltros,
  ListagemUsuariosResultado,
  UsuarioItemTabela,
} from "@farmaubs/shared";
import { User } from "../../../administracao/infrastructure/persistence/entities/user.entity";
import { UserUnit } from "../../../administracao/infrastructure/persistence/entities/UserUnit.entity";
import { MunicipioEntity } from "../../../administracao/infrastructure/persistence/entities/municipio.entity";
import { PerfilEntity } from "../persistence/entities/perfil.entity";
import { UnidadeSaudeEntity } from "../../../administracao/infrastructure/persistence/entities/unidade-saude.entity";
import { TransactionContext } from "../../../../common/transaction/transaction-context.service";

@Injectable()
export class TypeOrmUserRepository implements RepositorioUsuarioPort {
  constructor(private readonly transactionContext: TransactionContext) {}

  async buscarPorEmail(email: string): Promise<UsuarioModeloDominio | null> {
    const emailNormalizado = email.trim().toLowerCase();
    const manager = this.transactionContext.getManager();

    const usuario = await manager
      .createQueryBuilder(User, "u")
      .where("LOWER(u.email) = LOWER(:email)", { email: emailNormalizado })
      .getOne();

    if (!usuario) {
      return null;
    }

    return this.mapearParaDominio(usuario);
  }

  async existePorEmail(email: string): Promise<boolean> {
    const emailNormalizado = email.trim().toLowerCase();
    const manager = this.transactionContext.getManager();

    const quantidade = await manager
      .createQueryBuilder(User, "u")
      .where("LOWER(u.email) = LOWER(:email)", { email: emailNormalizado })
      .getCount();

    return quantidade > 0;
  }

  async salvar(
    dadosUsuario: DadosCriacaoUsuario,
    ubsIds: string[],
  ): Promise<UsuarioModeloDominio> {
    const manager = this.transactionContext.getManager();

    const usuarioId = dadosUsuario.id ?? randomUUID();
    const emailNormalizado = dadosUsuario.email.trim().toLowerCase();
    const nomeNormalizado = dadosUsuario.nomeCompleto.trim();

    const user = new User();
    user.id = usuarioId;
    user.municipio_id = dadosUsuario.municipioId;
    user.nome_completo = nomeNormalizado;
    user.email = emailNormalizado;
    user.senha_hash = dadosUsuario.senhaHash;
    user.perfil_id = dadosUsuario.perfilId;
    user.ativo = dadosUsuario.ativo ?? true;
    user.deve_trocar_senha = dadosUsuario.deveTrocarSenha ?? true;
    user.tentativas_login_falhas = dadosUsuario.tentativasLoginFalhas ?? 0;
    user.bloqueado_ate = dadosUsuario.bloqueadoAte ?? null;
    user.senha_atualizada_em = dadosUsuario.senhaAtualizadaEm ?? null;
    user.ultimo_login_em = null;

    const ubsIdsDeduplicados = Array.from(new Set(ubsIds));

    const persistirComTransacao = async (
      em: EntityManager,
    ): Promise<UsuarioModeloDominio> => {
      if (typeof em.query === "function" && dadosUsuario.municipioId) {
        await em.query(`SELECT set_config('app.municipio_id', $1, true)`, [
          dadosUsuario.municipioId,
        ]);
      }

      const usuarioSalvo = await em.save(User, user);

      if (ubsIdsDeduplicados.length > 0) {
        const vinculos = ubsIdsDeduplicados.map((ubsId) => {
          const userUnit = new UserUnit();
          userUnit.id = randomUUID();
          userUnit.usuarioId = usuarioSalvo.id;
          userUnit.unidadeId = ubsId;
          userUnit.ativo = true;
          return userUnit;
        });

        await em.save(UserUnit, vinculos);
      }

      return this.mapearParaDominio(usuarioSalvo);
    };

    if (manager.queryRunner?.isTransactionActive) {
      return await persistirComTransacao(manager);
    }

    return await manager.transaction(async (txManager) => {
      return await persistirComTransacao(txManager);
    });
  }

  async listar(
    filtros: ListagemUsuariosFiltros,
  ): Promise<ListagemUsuariosResultado> {
    const manager = this.transactionContext.getManager();
    const page =
      filtros.page && filtros.page >= 1 ? Math.floor(filtros.page) : 1;
    const limit =
      filtros.limit && filtros.limit >= 1
        ? Math.min(Math.floor(filtros.limit), 100)
        : 10;
    const offset = (page - 1) * limit;

    if (typeof manager.query === "function" && filtros.municipioId) {
      await manager.query(`SELECT set_config('app.municipio_id', $1, true)`, [
        filtros.municipioId.trim(),
      ]);
    }

    const qb = manager

      .createQueryBuilder(User, "u")
      .leftJoin(MunicipioEntity, "m", "m.id = u.municipio_id")
      .leftJoin(PerfilEntity, "p", "p.id = u.perfil_id")
      .select([
        "u.id AS id",
        'u.municipio_id AS "municipioId"',
        'm.nome AS "municipioNome"',
        'u.nome_completo AS "nomeCompleto"',
        "u.email AS email",
        'p.codigo AS "perfilCodigo"',
        'p.nome AS "perfilNome"',
        "u.ativo AS ativo",
        'u.ultimo_login_em AS "ultimoLoginEm"',
        'u.created_at AS "createdAt"',
      ]);

    if (filtros.busca) {
      const termo = `%${filtros.busca.trim().toLowerCase()}%`;
      qb.andWhere(
        "(LOWER(u.nome_completo) LIKE :termo OR LOWER(u.email) LIKE :termo)",
        { termo },
      );
    }

    if (filtros.municipioId) {
      qb.andWhere("u.municipio_id = :municipioId", {
        municipioId: filtros.municipioId.trim(),
      });
    }

    if (filtros.perfilId) {
      const perfilValor = filtros.perfilId.trim();
      qb.andWhere(
        "(u.perfil_id = :perfilValor OR UPPER(p.codigo) = :perfilUpper)",
        {
          perfilValor,
          perfilUpper: perfilValor.toUpperCase(),
        },
      );
    }

    if (filtros.status) {
      const statusUpper = filtros.status.trim().toUpperCase();
      if (statusUpper === "ATIVO") {
        qb.andWhere("u.ativo = :ativo", { ativo: true });
      } else if (statusUpper === "INATIVO") {
        qb.andWhere("u.ativo = :ativo", { ativo: false });
      }
    }

    qb.orderBy("u.created_at", "DESC");

    const total = await qb.getCount();
    const rawUsers = await qb.offset(offset).limit(limit).getRawMany();

    const userIds = rawUsers.map((u) => u.id);
    const ubsPorUsuario = new Map<
      string,
      Array<{ id: string; nome: string; cnes?: string }>
    >();

    if (userIds.length > 0) {
      const vinculos = await manager
        .createQueryBuilder(UserUnit, "uu")
        .innerJoin(UnidadeSaudeEntity, "us", "us.id = uu.unidade_id")
        .select([
          'uu.usuario_id AS "usuarioId"',
          'us.id AS "unidadeId"',
          'us.nome AS "unidadeNome"',
        ])
        .where("uu.usuario_id IN (:...userIds)", { userIds })
        .andWhere("uu.ativo = true")
        .getRawMany();

      for (const v of vinculos) {
        if (!ubsPorUsuario.has(v.usuarioId)) {
          ubsPorUsuario.set(v.usuarioId, []);
        }
        ubsPorUsuario.get(v.usuarioId)!.push({
          id: v.unidadeId,
          nome: v.unidadeNome,
        });
      }
    }

    const data: UsuarioItemTabela[] = rawUsers.map((u) => ({
      id: u.id,
      municipioId: u.municipioId,
      municipioNome: u.municipioNome ?? "Desconhecido",
      nomeCompleto: u.nomeCompleto,
      email: u.email,
      perfilCodigo: u.perfilCodigo ?? "DESCONHECIDO",
      perfilNome: u.perfilNome ?? "Desconhecido",
      unidades: ubsPorUsuario.get(u.id) ?? [],
      ativo: Boolean(u.ativo),
      ultimoLoginEm: u.ultimoLoginEm ? new Date(u.ultimoLoginEm) : null,
      createdAt: new Date(u.createdAt),
    }));

    const totalPages = Math.ceil(total / limit) || (total === 0 ? 0 : 1);

    return {
      data,
      total,
      page,
      limit,
      totalPages,
    };
  }

  async buscarPorId(id: string): Promise<UsuarioModeloDominio | null> {
    const manager = this.transactionContext.getManager();
    const user = await manager.findOne(User, { where: { id } });
    return user ? this.mapearParaDominio(user) : null;
  }

  async buscarUbsIds(usuarioId: string): Promise<string[]> {
    const manager = this.transactionContext.getManager();
    const vinculos = await manager.find(UserUnit, {
      where: { usuarioId, ativo: true },
      select: { unidadeId: true },
    });
    return vinculos.map((v) => v.unidadeId);
  }

  async atualizarDados(
    id: string,
    dados: { nomeCompleto?: string; email?: string },
  ): Promise<UsuarioModeloDominio> {
    const manager = this.transactionContext.getManager();
    const updatePayload: Partial<User> = { updated_at: new Date() };
    if (dados.nomeCompleto !== undefined) {
      updatePayload.nome_completo = dados.nomeCompleto.trim();
    }
    if (dados.email !== undefined) {
      updatePayload.email = dados.email.trim().toLowerCase();
    }
    await manager.update(User, { id }, updatePayload);
    const atualizado = await this.buscarPorId(id);
    if (!atualizado) {
      throw new Error(`Usuário ${id} não encontrado após atualização`);
    }
    return atualizado;
  }

  async atualizarPerfilEUbs(
    usuarioId: string,
    perfilId: string,
    ubsIds: string[],
  ): Promise<void> {
    const manager = this.transactionContext.getManager();
    await manager.update(
      User,
      { id: usuarioId },
      { perfil_id: perfilId, updated_at: new Date() },
    );

    const ubsSet = new Set(ubsIds);
    const vinculosAtuais = await manager.find(UserUnit, {
      where: { usuarioId },
    });
    const idsAtuais = new Set(vinculosAtuais.map((v) => v.unidadeId));

    const paraRemover = vinculosAtuais.filter((v) => !ubsSet.has(v.unidadeId));
    if (paraRemover.length > 0) {
      await manager.remove(UserUnit, paraRemover);
    }

    const paraInserir = ubsIds
      .filter((id) => !idsAtuais.has(id))
      .map((unidadeId) => {
        const uu = new UserUnit();
        uu.id = randomUUID();
        uu.usuarioId = usuarioId;
        uu.unidadeId = unidadeId;
        uu.ativo = true;
        return uu;
      });
    if (paraInserir.length > 0) {
      await manager.save(UserUnit, paraInserir);
    }
  }

  async atualizarStatus(
    id: string,
    ativo: boolean,
  ): Promise<UsuarioModeloDominio> {
    const manager = this.transactionContext.getManager();
    await manager.update(User, { id }, { ativo, updated_at: new Date() });
    const atualizado = await this.buscarPorId(id);
    if (!atualizado) {
      throw new Error(`Usuário ${id} não encontrado após alteração de status`);
    }
    return atualizado;
  }

  async atualizarSenhaProvisoria(id: string, senhaHash: string): Promise<void> {
    const manager = this.transactionContext.getManager();
    await manager.update(
      User,
      { id },
      {
        senha_hash: senhaHash,
        deve_trocar_senha: true,
        tentativas_login_falhas: 0,
        bloqueado_ate: null,
        senha_atualizada_em: new Date(),
        updated_at: new Date(),
      },
    );
  }

  async contarAdministradoresAtivos(): Promise<number> {
    const manager = this.transactionContext.getManager();
    return await manager
      .createQueryBuilder(User, "u")
      .innerJoin(PerfilEntity, "p", "p.id = u.perfil_id")
      .where("p.codigo = :codigo", { codigo: "ADMINISTRADOR" })
      .andWhere("u.ativo = true")
      .getCount();
  }

  async buscarSenhaHashPorId(id: string): Promise<string | null> {
    const manager = this.transactionContext.getManager();
    const user = await manager.findOne(User, {
      select: { id: true, senha_hash: true },
      where: { id },
    });
    return user?.senha_hash ?? null;
  }

  async concluirTrocaDeSenha(
    id: string,
    senhaHash: string,
    atualizadoEm: Date,
  ): Promise<void> {
    const manager = this.transactionContext.getManager();
    await manager.update(
      User,
      { id },
      {
        senha_hash: senhaHash,
        deve_trocar_senha: false,
        senha_atualizada_em: atualizadoEm,
        updated_at: new Date(),
      },
    );
  }

  private mapearParaDominio(user: User): UsuarioModeloDominio {
    const criadoEm = user.created_at ?? new Date();
    const atualizadoEm = user.updated_at ?? new Date();

    return {
      id: user.id,
      municipioId: user.municipio_id,
      nomeCompleto: user.nome_completo,
      email: user.email,
      perfilId: user.perfil_id,
      ativo: user.ativo,
      deveTrocarSenha: user.deve_trocar_senha,
      tentativasLoginFalhas: user.tentativas_login_falhas,
      bloqueadoAte: user.bloqueado_ate ?? null,
      senhaAtualizadaEm: user.senha_atualizada_em ?? null,
      ultimoLoginEm: user.ultimo_login_em ?? null,
      criadoEm,
      atualizadoEm,
      createdAt: criadoEm,
      updatedAt: atualizadoEm,
    };
  }
}

export type TypeOrmRepositorioUsuarioAdapter = TypeOrmUserRepository;
