import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
} from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
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
import { EfetivarDispensacaoUseCase } from "../../application/use-cases/efetivar-dispensacao.use-case";
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
import {
  DispensacaoEfetivadaResponseDto,
  EfetivarDispensacaoDto,
} from "../dto/dispensacao.dto";

@ApiTags("Dispensação")
@Controller("dispensacoes")
export class DispensacaoController {
  constructor(
    private readonly efetivarDispensacaoUseCase: EfetivarDispensacaoUseCase,
    private readonly tenantContext: TenantContextService,
  ) {}

  /**
   * Efetiva a dispensação de medicamentos em transação atômica com baixa imediata de estoque nos lotes (RF010, ADR-015).
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles(
    PerfilCodigo.FARMACEUTICO_RESPONSAVEL,
    PerfilCodigo.FARMACEUTICO_RESIDENTE,
    PerfilCodigo.ADMINISTRADOR,
  )
  @ApiBearerAuth("access-token")
  @ApiOperation({
    summary: "Efetiva a dispensação e realiza a baixa transacional de estoque (RF010, ADR-015)",
    description:
      "Valida os 4 campos obrigatórios do paciente, o prazo de 10 dias para receitas de antimicrobianos e decrementa os lotes com lock pessimista na UBS ativa da sessão.",
  })
  @ApiCreatedResponse({
    description: "Dispensação efetivada e estoque decrementado com sucesso.",
    type: DispensacaoEfetivadaResponseDto,
  })
  @ApiBadRequestResponse({
    description:
      "Dados inválidos, receita de antimicrobiano vencida (> 10 dias), lote fora da UBS ou saldo insuficiente.",
  })
  @ApiUnauthorizedResponse({
    description: "Não autorizado — token de autenticação ausente ou inválido.",
  })
  @ApiForbiddenResponse({
    description: "Acesso negado — perfil do usuário não autorizado para efetivar dispensação.",
  })
  async efetivar(
    @Body() dto: EfetivarDispensacaoDto,
    @CurrentUser() user?: AuthenticatedUserPayload,
  ): Promise<DispensacaoEfetivadaResponseDto> {
    const sessao = user as
      | (AuthenticatedUserPayload & {
          id?: string;
          userId?: string;
          unidadeId?: string;
          ubsId?: string;
          nomeCompleto?: string;
        })
      | undefined;

    const municipioId =
      sessao?.municipioId ?? this.tenantContext.getMunicipioId() ?? "";
    const unidadeId = sessao?.unidadeId ?? sessao?.ubsId ?? "";
    const dispensadorId = sessao?.id ?? sessao?.userId ?? "";
    const dispensadorNome = sessao?.nomeCompleto;

    try {
      return await this.efetivarDispensacaoUseCase.execute(dto, {
        municipioId,
        unidadeId,
        dispensadorId,
        dispensadorNome,
      });
    } catch (error) {
      if (
        error instanceof CpfInvalidoException ||
        error instanceof CnsInvalidoException ||
        error instanceof DadosPacienteInvalidosException ||
        error instanceof DadosDispensacaoInvalidosException ||
        error instanceof ReceitaAntimicrobianoVencidaException ||
        error instanceof SaldoInsuficienteLoteException ||
        error instanceof LoteNaoPertenceAUbsException
      ) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }
}

