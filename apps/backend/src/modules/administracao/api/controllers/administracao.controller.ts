import { Controller, Get, HttpCode, HttpStatus, Query } from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import type { MunicipioDto, UnidadeSaudeDto } from "@farmaubs/shared";
import { ListMunicipiosUseCase } from "../../application/use-cases/list-municipios.use-case";
import { ListUnidadesSaudeUseCase } from "../../application/use-cases/list-unidades-saude.use-case";
import { SkipTransaction } from "../../../../common/transaction/skip-transaction.decorator";

@ApiTags("Administração")
@Controller("administracao")
export class AdministracaoController {
  constructor(
    private readonly listMunicipiosUseCase: ListMunicipiosUseCase,
    private readonly listUnidadesSaudeUseCase: ListUnidadesSaudeUseCase,
  ) {}

  @Get("municipios")
  @SkipTransaction()
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth("access-token")
  @ApiOperation({
    summary: "Lista municípios ativos para seleção em formulários",
    description:
      "Retorna a listagem de todos os municípios ativos cadastrados no sistema, ordenados alfabeticamente por nome (RF001, RF026).",
  })
  @ApiOkResponse({
    description: "Lista de municípios ativos retornada com sucesso.",
  })
  @ApiUnauthorizedResponse({
    description: "Não autorizado — token de autenticação ausente ou inválido.",
  })
  async listarMunicipios(): Promise<MunicipioDto[]> {
    return this.listMunicipiosUseCase.executar();
  }

  @Get("unidades-saude")
  @SkipTransaction()
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth("access-token")
  @ApiOperation({
    summary: "Lista Unidades Básicas de Saúde vinculadas a um município",
    description:
      "Retorna a listagem de UBSs pertencentes ao município informado, ordenadas alfabeticamente por nome para preenchimento de seletores em cascata (RF026).",
  })
  @ApiQuery({
    name: "municipioId",
    required: true,
    description: "Identificador (UUID) do município",
    example: "01a06db9-c4af-7944-8ec5-c9b9443b054e",
  })
  @ApiOkResponse({
    description: "Lista de UBSs do município retornada com sucesso.",
  })
  @ApiBadRequestResponse({
    description: "Parâmetro 'municipioId' ausente ou inválido na requisição.",
  })
  @ApiUnauthorizedResponse({
    description: "Não autorizado — token de autenticação ausente ou inválido.",
  })
  async listarUnidadesSaude(
    @Query("municipioId") municipioId?: string,
  ): Promise<UnidadeSaudeDto[]> {
    return this.listUnidadesSaudeUseCase.executar(municipioId);
  }
}
