import { Injectable } from "@nestjs/common";
import type {
  DispensacaoEfetivadaResultado,
  ItemDispensadoResultadoDto,
  PacienteDispensacaoRequest,
} from "@farmaubs/shared";
import { TransactionContext } from "../../../../common/transaction/transaction-context.service";
import type {
  DispensacaoRepositoryPort,
  LoteBloqueadoDispensacao,
  RegistrarDispensacaoAtomicaParams,
} from "../../domain/ports/dispensacao.repository.port";
import { PacienteEntity } from "../persistence/entities/paciente.entity";
import { DispensacaoEntity } from "../persistence/entities/dispensacao.entity";
import { DispensacaoItemEntity } from "../persistence/entities/dispensacao-item.entity";

@Injectable()
export class TypeOrmDispensacaoRepository implements DispensacaoRepositoryPort {
  constructor(private readonly transactionContext: TransactionContext) {}

  /**
   * Localiza paciente existente no município por ID/CPF/CNS ou cria o registro na transação ativa.
   */
  async obterOuCriarPaciente(
    paciente: PacienteDispensacaoRequest,
    municipioId: string,
  ): Promise<{
    id: string;
    nomeCompleto: string;
    cpf: string;
    cns: string;
  }> {
    const manager = this.transactionContext.getManager();
    const existente = await manager.findOne(PacienteEntity, {
      where: paciente.id
        ? [
            { id: paciente.id, ativo: true },
            { cpf: paciente.cpf, ativo: true },
            { cns: paciente.cns, ativo: true },
          ]
        : [
            { cpf: paciente.cpf, ativo: true },
            { cns: paciente.cns, ativo: true },
          ],
    });

    if (existente) {
      return {
        id: existente.id,
        nomeCompleto: existente.nome_completo,
        cpf: existente.cpf,
        cns: existente.cns,
      };
    }

    const novo = manager.create(PacienteEntity, {
      municipio_id: municipioId,
      cns: paciente.cns,
      cpf: paciente.cpf,
      nome_completo: paciente.nomeCompleto,
      data_nascimento: paciente.dataNascimento,
      ativo: true,
    });
    const salvo = await manager.save(PacienteEntity, novo);

    return {
      id: salvo.id,
      nomeCompleto: salvo.nome_completo,
      cpf: salvo.cpf,
      cns: salvo.cns,
    };
  }

  /**
   * Bloqueia o registro do lote com SELECT ... FOR UPDATE para evitar condições de corrida (ADR-015).
   */
  async bloquearLoteParaUpdate(
    loteId: string,
  ): Promise<LoteBloqueadoDispensacao | null> {
    const manager = this.transactionContext.getManager();
    const rows = await manager.query(
      `SELECT
         l.id,
         l.numero_lote,
         l.unidade_id,
         l.medicamento_id,
         COALESCE(m.principio_ativo, l.medicamento_id::text) AS medicamento_nome,
         COALESCE(m.antimicrobiano, false) AS antimicrobiano,
         l.saldo_atual,
         l.data_validade
       FROM public.lotes l
       LEFT JOIN public.medicamentos m ON m.id = l.medicamento_id
       WHERE l.id = $1::uuid
       FOR UPDATE OF l`,
      [loteId],
    );

    const r = rows[0];
    if (!r) return null;

    return {
      id: r.id,
      numeroLote: r.numero_lote,
      unidadeId: r.unidade_id,
      medicamentoId: r.medicamento_id,
      medicamentoNome: r.medicamento_nome,
      antimicrobiano: Boolean(r.antimicrobiano),
      saldoAtual: Number(r.saldo_atual),
      dataValidade:
        r.data_validade instanceof Date
          ? r.data_validade.toISOString().slice(0, 10)
          : String(r.data_validade).slice(0, 10),
    };
  }

  /**
   * Decrementa atomicamente o saldo físico do lote e retorna o saldo remanescente.
   */
  async decrementarSaldoLote(
    loteId: string,
    quantidade: number,
  ): Promise<number> {
    const manager = this.transactionContext.getManager();
    const rows = await manager.query(
      `UPDATE public.lotes
          SET saldo_atual = saldo_atual - $2,
              updated_at = now()
        WHERE id = $1::uuid
      RETURNING saldo_atual`,
      [loteId, quantidade],
    );

    return Number(rows[0]?.saldo_atual ?? 0);
  }

  /**
   * Grava o cabeçalho e os itens da dispensação na mesma transação do decremento de lotes.
   */
  async registrarDispensacaoAtomica(
    dados: RegistrarDispensacaoAtomicaParams,
  ): Promise<DispensacaoEfetivadaResultado> {
    const manager = this.transactionContext.getManager();
    const numeroAtendimento = `DISP-${Date.now()}`;

    const dispensacaoEntity = manager.create(DispensacaoEntity, {
      municipio_id: dados.municipioId,
      unidade_id: dados.unidadeId,
      paciente_id: dados.paciente.id,
      dispensador_id: dados.dispensadorId,
      numero_atendimento: numeroAtendimento,
      status: "concluida",
      receita_emissao_em: dados.receitaEmissaoEm ?? null,
    });

    const dispensacaoSalva = await manager.save(
      DispensacaoEntity,
      dispensacaoEntity,
    );

    const itensResultado: ItemDispensadoResultadoDto[] = [];
    for (const item of dados.itens) {
      const itemEntity = manager.create(DispensacaoItemEntity, {
        municipio_id: dados.municipioId,
        dispensacao_id: dispensacaoSalva.id,
        medicamento_id: item.medicamentoId,
        lote_id: item.loteId,
        quantidade_dispensada: item.quantidadeDispensada,
        posologia: item.posologia ?? null,
      });
      const itemSalvo = await manager.save(DispensacaoItemEntity, itemEntity);

      itensResultado.push({
        itemId: itemSalvo.id,
        medicamentoId: item.medicamentoId,
        medicamentoNome: item.medicamentoNome,
        loteId: item.loteId,
        numeroLote: item.numeroLote,
        quantidadeDispensada: item.quantidadeDispensada,
        saldoRestanteLote: item.saldoRestanteLote,
      });
    }

    return {
      id: dispensacaoSalva.id,
      numeroAtendimento: dispensacaoSalva.numero_atendimento ?? numeroAtendimento,
      dataAtendimento: dispensacaoSalva.created_at,
      status: dispensacaoSalva.status,
      paciente: dados.paciente,
      dispensador: {
        id: dados.dispensadorId,
        nomeCompleto: dados.dispensadorNome ?? "Farmacêutico",
      },
      itens: itensResultado,
    };
  }
}

