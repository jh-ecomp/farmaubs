import {
  type DispensacaoEfetivadaResultado,
  type EfetivarDispensacaoRequest,
  limparNaoNumericos,
  validarCNS,
  validarCPF,
  validarReceitaAntimicrobiano,
} from "@farmaubs/shared";
import {
  CnsInvalidoException,
  CpfInvalidoException,
  DadosPacienteInvalidosException,
} from "../../domain/errors/paciente.errors";
import {
  DadosDispensacaoInvalidosException,
  LoteNaoPertenceAUbsException,
  ReceitaAntimicrobianoVencidaException,
  SaldoInsuficienteLoteException,
} from "../../domain/errors/dispensacao.errors";
import type {
  DispensacaoRepositoryPort,
  ItemPersistirDispensacao,
  LoteBloqueadoDispensacao,
} from "../../domain/ports/dispensacao.repository.port";

export interface ContextoAtendimentoDispensacao {
  municipioId: string;
  unidadeId: string;
  dispensadorId: string;
  dispensadorNome?: string;
}

export class EfetivarDispensacaoUseCase {
  constructor(
    private readonly dispensacaoRepository: DispensacaoRepositoryPort,
  ) {}

  /**
   * Efetiva a dispensação de medicamentos validando os 4 campos do paciente,
   * prazo de 10 dias de receitas de antimicrobianos e baixa transacional de estoque com lock pessimista (ADR-015, RF010).
   * @param request Payload de efetivação contendo paciente, data de emissão da receita e itens.
   * @param contexto Identificadores de escopo extraídos da sessão autenticada.
   * @param dataReferencia Data base do atendimento para validação da receita (padrão: hoje).
   * @returns Resultado da dispensação concluída com os saldos remanescentes dos lotes.
   */
  async execute(
    request: EfetivarDispensacaoRequest,
    contexto: ContextoAtendimentoDispensacao,
    dataReferencia: Date = new Date(),
  ): Promise<DispensacaoEfetivadaResultado> {
    if (!contexto.municipioId || !contexto.unidadeId || !contexto.dispensadorId) {
      throw new DadosDispensacaoInvalidosException(
        "Escopo de município, unidade de saúde e dispensador são obrigatórios na sessão.",
      );
    }

    const pacienteNormalizado = this.validarDadosPaciente(
      request.paciente,
      dataReferencia,
    );

    if (!Array.isArray(request.itens) || request.itens.length === 0) {
      throw new DadosDispensacaoInvalidosException(
        "A dispensação deve conter ao menos um item.",
      );
    }

    for (const item of request.itens) {
      if (
        !item.loteId ||
        !item.medicamentoId ||
        !Number.isInteger(item.quantidadeDispensada) ||
        item.quantidadeDispensada <= 0
      ) {
        throw new DadosDispensacaoInvalidosException(
          "Todo item da dispensação deve possuir lote, medicamento e quantidade inteira positiva.",
        );
      }
    }

    const lotesBloqueados = new Map<string, LoteBloqueadoDispensacao>();
    let contemAntimicrobiano = false;

    for (const item of request.itens) {
      let lote = lotesBloqueados.get(item.loteId);
      if (!lote) {
        const encontrado =
          await this.dispensacaoRepository.bloquearLoteParaUpdate(item.loteId);
        if (!encontrado || encontrado.unidadeId !== contexto.unidadeId) {
          throw new LoteNaoPertenceAUbsException(item.loteId);
        }
        lote = encontrado;
        lotesBloqueados.set(item.loteId, lote);
      }
      if (lote.antimicrobiano) {
        contemAntimicrobiano = true;
      }
    }

    const validacaoReceita = validarReceitaAntimicrobiano(
      request.receitaEmissaoEm,
      contemAntimicrobiano,
      dataReferencia,
    );
    if (!validacaoReceita.valida) {
      throw new ReceitaAntimicrobianoVencidaException();
    }

    const quantidadePorLote = new Map<string, number>();
    for (const item of request.itens) {
      const acumulado =
        (quantidadePorLote.get(item.loteId) ?? 0) + item.quantidadeDispensada;
      quantidadePorLote.set(item.loteId, acumulado);
      const lote = lotesBloqueados.get(item.loteId)!;
      if (lote.saldoAtual < acumulado) {
        throw new SaldoInsuficienteLoteException(
          lote.numeroLote,
          lote.saldoAtual,
          acumulado,
        );
      }
    }

    const paciente = await this.dispensacaoRepository.obterOuCriarPaciente(
      pacienteNormalizado,
      contexto.municipioId,
    );

    const itensPersistir: ItemPersistirDispensacao[] = [];
    for (const item of request.itens) {
      const lote = lotesBloqueados.get(item.loteId)!;
      const saldoRestante =
        await this.dispensacaoRepository.decrementarSaldoLote(
          item.loteId,
          item.quantidadeDispensada,
        );
      lote.saldoAtual = saldoRestante;

      itensPersistir.push({
        medicamentoId: item.medicamentoId,
        medicamentoNome: lote.medicamentoNome,
        loteId: item.loteId,
        numeroLote: lote.numeroLote,
        quantidadeDispensada: item.quantidadeDispensada,
        posologia: item.posologia,
        saldoRestanteLote: saldoRestante,
      });
    }

    return this.dispensacaoRepository.registrarDispensacaoAtomica({
      municipioId: contexto.municipioId,
      unidadeId: contexto.unidadeId,
      dispensadorId: contexto.dispensadorId,
      dispensadorNome: contexto.dispensadorNome,
      paciente,
      receitaEmissaoEm: request.receitaEmissaoEm,
      itens: itensPersistir,
    });
  }

  private validarDadosPaciente(
    paciente: EfetivarDispensacaoRequest["paciente"],
    dataReferencia: Date,
  ) {
    if (!paciente) {
      throw new DadosPacienteInvalidosException("Dados do paciente são obrigatórios.");
    }

    const cnsLimpo = limparNaoNumericos(paciente.cns ?? "");
    if (!validarCNS(cnsLimpo)) {
      throw new CnsInvalidoException(
        "CNS deve conter exatamente 15 dígitos numéricos válidos.",
      );
    }

    const cpfLimpo = limparNaoNumericos(paciente.cpf ?? "");
    if (!validarCPF(cpfLimpo)) {
      throw new CpfInvalidoException(
        "CPF com dígitos verificadores matematicamente incorretos.",
      );
    }

    const nome = paciente.nomeCompleto ? paciente.nomeCompleto.trim() : "";
    if (nome.length < 3 || nome.length > 150 || /[\x00-\x1F\x7F]/.test(nome)) {
      throw new DadosPacienteInvalidosException(
        "Nome completo deve conter entre 3 e 150 caracteres sem caracteres de controle.",
      );
    }

    if (
      !paciente.dataNascimento ||
      !/^\d{4}-\d{2}-\d{2}$/.test(paciente.dataNascimento)
    ) {
      throw new DadosPacienteInvalidosException(
        "Data de nascimento deve estar no formato AAAA-MM-DD.",
      );
    }

    const dataNasc = new Date(`${paciente.dataNascimento}T00:00:00Z`);
    if (
      Number.isNaN(dataNasc.getTime()) ||
      dataNasc.toISOString().slice(0, 10) !== paciente.dataNascimento
    ) {
      throw new DadosPacienteInvalidosException("Data de nascimento inválida.");
    }

    if (dataNasc > dataReferencia) {
      throw new DadosPacienteInvalidosException(
        "Data de nascimento não pode estar no futuro.",
      );
    }

    const limite130Anos = new Date(dataReferencia);
    limite130Anos.setFullYear(dataReferencia.getFullYear() - 130);
    if (dataNasc < limite130Anos) {
      throw new DadosPacienteInvalidosException(
        "Data de nascimento não pode ter mais de 130 anos.",
      );
    }

    return {
      id: paciente.id,
      cns: cnsLimpo,
      cpf: cpfLimpo,
      nomeCompleto: nome,
      dataNascimento: paciente.dataNascimento,
    };
  }
}

