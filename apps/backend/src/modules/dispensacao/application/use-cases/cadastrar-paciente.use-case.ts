import { Inject, Injectable } from "@nestjs/common";
import {
  type CadastrarPacienteRequest,
  type PacienteDto,
  limparNaoNumericos,
  validarCPF,
  validarCNS,
} from "@farmaubs/shared";
import {
  CnsInvalidoException,
  CpfInvalidoException,
  DadosPacienteInvalidosException,
  PacienteJaCadastradoException,
} from "../../domain/errors/paciente.errors";
import {
  PACIENTE_REPOSITORY_PORT,
  type PacienteRepositoryPort,
} from "../../domain/ports/paciente.repository.port";

@Injectable()
export class CadastrarPacienteUseCase {
  constructor(
    @Inject(PACIENTE_REPOSITORY_PORT)
    private readonly pacienteRepository: PacienteRepositoryPort,
  ) {}

  /**
   * Executa o cadastro de um novo paciente aplicando validações dos 4 campos clínicos (RF010).
   * @param dados Dados cadastrais obrigatórios do paciente (CNS, CPF, nome completo, data de nascimento).
   * @param municipioId Identificador do município da sessão ativa.
   * @returns O DTO do paciente persistido com seu identificador UUID.
   */
  async execute(
    dados: CadastrarPacienteRequest,
    municipioId: string,
  ): Promise<PacienteDto> {
    if (!municipioId) {
      throw new DadosPacienteInvalidosException(
        "Município da sessão não identificado.",
      );
    }

    const cnsLimpo = limparNaoNumericos(dados.cns ?? "");
    if (!validarCNS(cnsLimpo)) {
      throw new CnsInvalidoException(
        "CNS deve conter exatamente 15 dígitos numéricos válidos.",
      );
    }

    const cpfLimpo = limparNaoNumericos(dados.cpf ?? "");
    if (!validarCPF(cpfLimpo)) {
      throw new CpfInvalidoException(
        "CPF com dígitos verificadores matematicamente incorretos.",
      );
    }

    const nome = dados.nomeCompleto ? dados.nomeCompleto.trim() : "";
    if (nome.length < 3 || nome.length > 150 || /[\x00-\x1F\x7F]/.test(nome)) {
      throw new DadosPacienteInvalidosException(
        "Nome completo deve conter entre 3 e 150 caracteres sem caracteres de controle.",
      );
    }

    if (
      !dados.dataNascimento ||
      !/^\d{4}-\d{2}-\d{2}$/.test(dados.dataNascimento)
    ) {
      throw new DadosPacienteInvalidosException(
        "Data de nascimento deve estar no formato AAAA-MM-DD.",
      );
    }

    const dataNasc = new Date(`${dados.dataNascimento}T00:00:00Z`);
    if (
      Number.isNaN(dataNasc.getTime()) ||
      dataNasc.toISOString().slice(0, 10) !== dados.dataNascimento
    ) {
      throw new DadosPacienteInvalidosException("Data de nascimento inválida.");
    }

    const agora = new Date();
    if (dataNasc > agora) {
      throw new DadosPacienteInvalidosException(
        "Data de nascimento não pode estar no futuro.",
      );
    }

    const limite130Anos = new Date();
    limite130Anos.setFullYear(agora.getFullYear() - 130);
    if (dataNasc < limite130Anos) {
      throw new DadosPacienteInvalidosException(
        "Data de nascimento não pode ter mais de 130 anos.",
      );
    }

    const existente = await this.pacienteRepository.buscarPorCpfOuCns(
      cpfLimpo,
      cnsLimpo,
    );
    if (existente) {
      throw new PacienteJaCadastradoException(
        "Já existe um paciente cadastrado com este CPF ou CNS neste município.",
      );
    }

    return this.pacienteRepository.salvar({
      cns: cnsLimpo,
      cpf: cpfLimpo,
      nomeCompleto: nome,
      dataNascimento: dados.dataNascimento,
      municipioId,
    });
  }
}

