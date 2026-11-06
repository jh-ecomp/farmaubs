import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import {
  type AuthenticatedUserPayload,
  PerfilCodigo,
} from "@farmaubs/shared";
import { CurrentUser, Roles } from "../../../../common/decorators";
import { TenantContextService } from "../../../../common/tenant/tenant-context.service";
import { CadastrarPacienteUseCase } from "../../application/use-cases/cadastrar-paciente.use-case";
import { BuscarPacientesUseCase } from "../../application/use-cases/buscar-pacientes.use-case";
import { ConsultarHistoricoPacienteUseCase } from "../../application/use-cases/consultar-historico-paciente.use-case";
import {
  BuscarPacientesQueryDto,
  CadastrarPacienteDto,
  HistoricoPacienteResponseDto,
  PacienteResponseDto,
} from "../dto/paciente.dto";
import {
  CnsInvalidoException,
  CpfInvalidoException,
  DadosPacienteInvalidosException,
  PacienteJaCadastradoException,
  PacienteNaoEncontradoException,
} from "../../domain/errors/paciente.errors";

@ApiTags("Dispensação")
@Controller("dispensacao/pacientes")
export class PacienteController {
  constructor(
    private readonly cadastrarPacienteUseCase: CadastrarPacienteUseCase,
    private readonly buscarPacientesUseCase: BuscarPacientesUseCase,
    private readonly consultarHistoricoPacienteUseCase: ConsultarHistoricoPacienteUseCase,
    private readonly tenantContext: TenantContextService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles(
    PerfilCodigo.FARMACEUTICO_RESPONSAVEL,
    PerfilCodigo.FARMACEUTICO_RESIDENTE,
    PerfilCodigo.ADMINISTRADOR,
  )
  @ApiBearerAuth("access-token")
  @ApiOperation({
    summary: "Cadastra um novo paciente com validação obrigatória dos 4 campos clínicos (RF010)",
    description:
      "Registra o paciente com validação estrita de CNS (15 dígitos), CPF válido, nome completo e data de nascimento não futura, isolado pelo município da sessão (ADR-002, NF017).",
  })
  @ApiCreatedResponse({
    description: "Paciente cadastrado com sucesso.",
    type: PacienteResponseDto,
  })
  @ApiBadRequestResponse({
    description: "Dados inválidos: CNS, CPF, nome completo ou data de nascimento fora das regras clínicas.",
  })
  @ApiConflictResponse({
    description: "Conflito: paciente já cadastrado neste município com o mesmo CPF ou CNS.",
  })
  @ApiUnauthorizedResponse({
    description: "Não autorizado — token de autenticação ausente ou inválido.",
  })
  @ApiForbiddenResponse({
    description: "Acesso negado — perfil do usuário não autorizado para cadastrar pacientes.",
  })
  async cadastrar(
    @Body() dto: CadastrarPacienteDto,
    @CurrentUser() user?: AuthenticatedUserPayload,
  ): Promise<PacienteResponseDto> {
    const municipioId = user?.municipioId ?? this.tenantContext.getMunicipioId();
    if (!municipioId) {
      throw new BadRequestException("Município da sessão não identificado.");
    }

    try {
      return await this.cadastrarPacienteUseCase.execute(dto, municipioId);
    } catch (error) {
      if (
        error instanceof CpfInvalidoException ||
        error instanceof CnsInvalidoException ||
        error instanceof DadosPacienteInvalidosException
      ) {
        throw new BadRequestException(error.message);
      }
      if (error instanceof PacienteJaCadastradoException) {
        throw new ConflictException(error.message);
      }
      throw error;
    }
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @Roles(
    PerfilCodigo.FARMACEUTICO_RESPONSAVEL,
    PerfilCodigo.FARMACEUTICO_RESIDENTE,
    PerfilCodigo.GERENTE,
    PerfilCodigo.ADMINISTRADOR,
  )
  @ApiBearerAuth("access-token")
  @ApiOperation({
    summary: "Busca pacientes por CPF, CNS ou nome",
    description:
      "Consulta flexível e paginada retornando até 10 pacientes correspondentes no município da sessão para autocomplete no balcão de atendimento (RF010, NF010).",
  })
  @ApiOkResponse({
    description: "Lista de pacientes retornada com sucesso.",
    type: [PacienteResponseDto],
  })
  @ApiUnauthorizedResponse({
    description: "Não autorizado — token de autenticação ausente ou inválido.",
  })
  @ApiForbiddenResponse({
    description: "Acesso negado — perfil do usuário não autorizado.",
  })
  async buscar(
    @Query() query: BuscarPacientesQueryDto,
  ): Promise<PacienteResponseDto[]> {
    return this.buscarPacientesUseCase.execute(query.termo);
  }

  @Get(":id/historico")
  @HttpCode(HttpStatus.OK)
  @Roles(
    PerfilCodigo.FARMACEUTICO_RESPONSAVEL,
    PerfilCodigo.FARMACEUTICO_RESIDENTE,
    PerfilCodigo.GERENTE,
    PerfilCodigo.ADMINISTRADOR,
  )
  @ApiBearerAuth("access-token")
  @ApiOperation({
    summary: "Consulta histórico de dispensas do paciente (últimos 90 dias)",
    description:
      "Retorna o cadastro do paciente e todas as retiradas dos últimos 90 dias com indicação de possível uso irracional (< 25 dias) para apoio à decisão clínica (RF012).",
  })
  @ApiOkResponse({
    description: "Histórico de dispensas do paciente retornado com sucesso.",
    type: HistoricoPacienteResponseDto,
  })
  @ApiNotFoundResponse({
    description: "Paciente não encontrado.",
  })
  @ApiUnauthorizedResponse({
    description: "Não autorizado — token de autenticação ausente ou inválido.",
  })
  @ApiForbiddenResponse({
    description: "Acesso negado — perfil do usuário não autorizado.",
  })
  async consultarHistorico(
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<HistoricoPacienteResponseDto> {
    try {
      return await this.consultarHistoricoPacienteUseCase.execute(id);
    } catch (error) {
      if (error instanceof PacienteNaoEncontradoException) {
        throw new NotFoundException(error.message);
      }
      throw error;
    }
  }
}

