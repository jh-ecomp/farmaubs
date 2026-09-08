import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { randomUUID } from 'node:crypto';
import { RepositorioUsuarioPort } from '../../domain/ports/user.repository.port';
import {
  DadosCriacaoUsuario,
  UsuarioModeloDominio,
} from '../../domain/models/user-registration.model';
import { User } from '../../../administracao/infrastructure/persistence/entities/user.entity';
import { UserUnit } from '../../../administracao/infrastructure/persistence/entities/UserUnit.entity';
import { TransactionContext } from '../../../../common/transaction/transaction-context.service';

@Injectable()
export class TypeOrmUserRepository implements RepositorioUsuarioPort {
  constructor(private readonly transactionContext: TransactionContext) {}

  async buscarPorEmail(email: string): Promise<UsuarioModeloDominio | null> {
    const emailNormalizado = email.trim().toLowerCase();
    const manager = this.transactionContext.getManager();

    const usuario = await manager
      .createQueryBuilder(User, 'u')
      .where('LOWER(u.email) = LOWER(:email)', { email: emailNormalizado })
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
      .createQueryBuilder(User, 'u')
      .where('LOWER(u.email) = LOWER(:email)', { email: emailNormalizado })
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
