import { Injectable } from "@nestjs/common";
import {
  type CadastrarPacienteRequest,
  type PacienteDto,
  limparNaoNumericos,
} from "@farmaubs/shared";
import { TransactionContext } from "../../../../common/transaction/transaction-context.service";
import {
  type ItemHistoricoRegistro,
  type PacienteRepositoryPort,
} from "../../domain/ports/paciente.repository.port";
import { PacienteEntity } from "../persistence/entities/paciente.entity";
import { DispensacaoItemEntity } from "../persistence/entities/dispensacao-item.entity";

@Injectable()
export class TypeOrmPacienteRepository implements PacienteRepositoryPort {
  constructor(private readonly transactionContext: TransactionContext) {}

  /**
   * Busca paciente por ID no escopo do tenant atual.
   */
  async buscarPorId(id: string): Promise<PacienteDto | null> {
    const manager = this.transactionContext.getManager();
    const entity = await manager.findOne(PacienteEntity, {
      where: { id, ativo: true },
    });
    return entity ? this.toDto(entity) : null;
  }

  /**
   * Busca paciente por CPF ou CNS no escopo do tenant atual.
   */
  async buscarPorCpfOuCns(cpf: string, cns: string): Promise<PacienteDto | null> {
    const manager = this.transactionContext.getManager();
    const entity = await manager.findOne(PacienteEntity, {
      where: [
        { cpf, ativo: true },
        { cns, ativo: true },
      ],
    });
    return entity ? this.toDto(entity) : null;
  }

  /**
   * Busca pacientes ativos por termo textual (CPF, CNS ou nome completo) com limite de resultados.
   */
  async buscarPorTermo(termo: string, limite = 10): Promise<PacienteDto[]> {
    const manager = this.transactionContext.getManager();
    const termoNumerico = limparNaoNumericos(termo);
    const qb = manager.createQueryBuilder(PacienteEntity, "p").where("p.ativo = true");

    if (termoNumerico.length >= 3) {
      qb.andWhere(
        "(p.cpf ILIKE :numTermo OR p.cns ILIKE :numTermo OR p.nome_completo ILIKE :nomeTermo)",
        {
          numTermo: `%${termoNumerico}%`,
          nomeTermo: `%${termo}%`,
        },
      );
    } else {
      qb.andWhere("p.nome_completo ILIKE :nomeTermo", {
        nomeTermo: `%${termo}%`,
      });
    }

    const entidades = await qb.orderBy("p.created_at", "DESC").limit(limite).getMany();
    return entidades.map((e) => this.toDto(e));
  }

  /**
   * Persiste um novo paciente no banco de dados.
   */
  async salvar(
    dados: CadastrarPacienteRequest & { municipioId: string },
  ): Promise<PacienteDto> {
    const manager = this.transactionContext.getManager();
    const entity = manager.create(PacienteEntity, {
      municipio_id: dados.municipioId,
      cns: dados.cns,
      cpf: dados.cpf,
      nome_completo: dados.nomeCompleto,
      data_nascimento: dados.dataNascimento,
      ativo: true,
    });
    const salvo = await manager.save(PacienteEntity, entity);
    return this.toDto(salvo);
  }

  /**
   * Retorna os itens dispensados para o paciente nos últimos 90 dias com status 'concluida'.
   */
  async buscarHistorico90Dias(pacienteId: string): Promise<ItemHistoricoRegistro[]> {
    const manager = this.transactionContext.getManager();
    const noventaDiasAtras = new Date();
    noventaDiasAtras.setDate(noventaDiasAtras.getDate() - 90);

    const itens = await manager
      .createQueryBuilder(DispensacaoItemEntity, "item")
      .innerJoinAndSelect("item.dispensacao", "disp")
      .where("disp.paciente_id = :pacienteId", { pacienteId })
      .andWhere("disp.status = 'concluida'")
      .andWhere("disp.created_at >= :dataLimite", { dataLimite: noventaDiasAtras })
      .orderBy("disp.created_at", "DESC")
      .getMany();

    return itens.map((item) => ({
      dispensacaoId: item.dispensacao_id,
      dataDispensacao: item.dispensacao?.created_at ?? item.created_at,
      medicamentoId: item.medicamento_id,
      medicamentoNome: item.medicamento_id,
      quantidadeDispensada: item.quantidade_dispensada,
      posologia: item.posologia ?? undefined,
    }));
  }

  private toDto(p: PacienteEntity): PacienteDto {
    return {
      id: p.id,
      municipioId: p.municipio_id,
      cns: p.cns,
      cpf: p.cpf,
      nomeCompleto: p.nome_completo,
      dataNascimento: String(p.data_nascimento),
      ativo: p.ativo,
      criadoEm: p.created_at,
    };
  }
}

