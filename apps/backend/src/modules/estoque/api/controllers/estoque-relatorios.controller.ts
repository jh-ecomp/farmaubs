import {
  BadRequestException,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Query,
  Res,
  StreamableFile,
} from "@nestjs/common";
import type { Response } from "express";
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { PerfilCodigo } from "@farmaubs/shared";
import { Roles } from "../../../../common/decorators";
import { TenantScoped } from "../../../../common/decorators/tenant-scoped.decorator";
import { GerarRelatorioEstoqueXlsxUseCase } from "../../application/use-cases/gerar-relatorio-estoque-xlsx.use-case";
import { ExportarRelatorioEstoqueQueryDto } from "../dto/exportar-relatorio-estoque-query.dto";
import {
  IntervaloDatasRelatorioInvalidoException,
  UbsNaoEncontradaRelatorioException,
} from "../../domain/errors/estoque-relatorios.errors";

@ApiTags("Estoque")
@Controller("estoque")
export class EstoqueRelatoriosController {
  constructor(
    private readonly gerarRelatorioUseCase: GerarRelatorioEstoqueXlsxUseCase,
  ) {}

  /**
   * [RF020 / RF028 / NF007 / NF015]: Exporta dados de estoque e extratos para planilha XLSX via ExcelJS.
   * @param query - Filtros validados contendo `unidadeId`, `tipoRelatorio`, período e filtros opcionais.
   * @param res - Objeto Response do Express para definição dos cabeçalhos HTTP de download binário.
   * @returns `StreamableFile` contendo o binário `.xlsx` gerado.
   * @throws {BadRequestException} Quando parâmetros ou intervalo de datas forem inválidos (400).
   * @throws {NotFoundException} Quando a UBS não existir no município ativo do tenant (404).
   */
  @Get("relatorios/exportar-xlsx")
  @Roles(
    PerfilCodigo.FARMACEUTICO_RESPONSAVEL,
    PerfilCodigo.FARMACEUTICO_RESIDENTE,
    PerfilCodigo.GERENTE,
    PerfilCodigo.ADMINISTRADOR,
  )
  @TenantScoped({ checkUbs: true })
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth("access-token")
  @ApiProduces(
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  )
  @ApiOperation({
    summary: "Exporta relatório de estoque em formato XLSX",
    description:
      "Gera e descarrega planilha formatada em Excel (.xlsx) para saldos atuais, perdas (vencimento, avaria, extravio e recolhimento sanitário) ou extrato cronológico de movimentações.",
  })
  @ApiOkResponse({
    description: "Arquivo XLSX gerado com sucesso.",
    schema: {
      type: "string",
      format: "binary",
    },
  })
  @ApiBadRequestResponse({
    description: "Parâmetros inválidos ou intervalo de datas inconsistente.",
  })
  @ApiUnauthorizedResponse({ description: "Usuário não autenticado." })
  @ApiForbiddenResponse({
    description: "Usuário sem perfil necessário ou fora da unidade solicitada.",
  })
  @ApiNotFoundResponse({ description: "Unidade de saúde não encontrada." })
  async exportarXlsx(
    @Query() query: ExportarRelatorioEstoqueQueryDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    try {
      const { buffer, nomeArquivo, contentType } =
        await this.gerarRelatorioUseCase.execute({
          tipoRelatorio: query.tipoRelatorio,
          ubsId: query.unidadeId,
          dataInicio: query.dataInicio,
          dataFim: query.dataFim,
          principioAtivo: query.principioAtivo?.trim() || undefined,
          produtoId: query.produtoId,
          categoria: query.categoria?.trim() || undefined,
        });

      res.set({
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${nomeArquivo}"`,
        "Content-Length": String(buffer.length),
      });
      return new StreamableFile(buffer);
    } catch (error) {
      if (error instanceof IntervaloDatasRelatorioInvalidoException) {
        throw new BadRequestException(error.message);
      }
      if (error instanceof UbsNaoEncontradaRelatorioException) {
        throw new NotFoundException(error.message);
      }
      throw error;
    }
  }
}
