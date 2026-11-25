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
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import {
  PerfilCodigo,
  type AuthenticatedUserPayload,
} from "@farmaubs/shared";
import { CurrentUser, Roles } from "../../../../common/decorators";
import { TenantScoped } from "../../../../common/decorators/tenant-scoped.decorator";
import { GerarRelatorioEstoqueXlsxUseCase } from "../../application/use-cases/gerar-relatorio-estoque-xlsx.use-case";
import {
  ExportarRelatorioEstoqueQueryDto,
  validarEObterUbsIdRelatorio,
} from "../dto/exportar-relatorio-estoque-query.dto";
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
   * Valida unidadeId do escopo do usuário via RLS e restringe acesso a farmacêuticos, gerentes e administradores.
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
  @ApiOperation({
    summary: "Exporta relatório de estoque em formato XLSX",
    description:
      "Gera e descarrega planilha formatada em Excel (.xlsx) para saldos atuais, perdas por vencimento/avaria ou extrato cronológico de movimentações.",
  })
  @ApiOkResponse({
    description: "Arquivo XLSX gerado com sucesso.",
    schema: {
      type: "string",
      format: "binary",
    },
  })
  @ApiBadRequestResponse({ description: "Parâmetros inválidos ou intervalo de datas inconsistente." })
  @ApiUnauthorizedResponse({ description: "Usuário não autenticado." })
  @ApiForbiddenResponse({ description: "Usuário sem perfil necessário ou fora da unidade solicitada." })
  @ApiNotFoundResponse({ description: "Unidade de saúde não encontrada." })
  async exportarXlsx(
    @Query() query: ExportarRelatorioEstoqueQueryDto,
    @CurrentUser() user: AuthenticatedUserPayload | undefined,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const ubsId = validarEObterUbsIdRelatorio(user, query.unidadeId);

    try {
      const { buffer, nomeArquivo, contentType } =
        await this.gerarRelatorioUseCase.execute({
          tipoRelatorio: query.tipoRelatorio,
          ubsId,
          dataInicio: query.dataInicio,
          dataFim: query.dataFim,
          principioAtivo: query.principioAtivo,
          produtoId: query.produtoId,
          categoria: query.categoria,
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
