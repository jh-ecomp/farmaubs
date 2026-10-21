import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
} from "class-validator";
import type {
  DispensacaoItemListaDto,
  DispensacoesPaginadasResultado,
  EstornarDispensacaoRequest,
  EstornarDispensacaoResultado,
  ListarDispensacoesQuery,
} from "@farmaubs/shared";

export class ListarDispensacoesQueryDto implements ListarDispensacoesQuery {
  @ApiPropertyOptional({ description: "Página atual (1-based)", default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pagina?: number;

  @ApiPropertyOptional({
    description: "Quantidade de itens por página",
    default: 20,
    maximum: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limite?: number;

  @ApiPropertyOptional({
    description: "Data inicial (AAAA-MM-DD). Padrão: ontem (D-1)",
    example: "2026-10-20",
  })
  @IsOptional()
  @IsString()
  dataInicio?: string;

  @ApiPropertyOptional({
    description: "Data final (AAAA-MM-DD). Padrão: hoje (D0)",
    example: "2026-10-21",
  })
  @IsOptional()
  @IsString()
  dataFim?: string;

  @ApiPropertyOptional({
    description: "Termo parcial para busca por nome, CPF ou CNS do paciente",
    example: "12345678909",
  })
  @IsOptional()
  @IsString()
  pacienteTermo?: string;

  @ApiPropertyOptional({
    description: "Termo parcial para busca por princípio ativo ou nome comercial",
    example: "Dipirona",
  })
  @IsOptional()
  @IsString()
  medicamentoTermo?: string;

  @ApiPropertyOptional({
    description: "Filtro por categoria farmacêutica/clínica",
    example: "Hipertensão",
  })
  @IsOptional()
  @IsString()
  categoria?: string;

  @ApiPropertyOptional({
    description: "Filtro por status da dispensação",
    enum: ["concluida", "estornada"],
  })
  @IsOptional()
  @IsIn(["concluida", "estornada"])
  status?: "concluida" | "estornada";
}

export class DispensacaoItemListaResponseDto
  implements DispensacaoItemListaDto
{
  @ApiProperty({ example: "0194e43e-a6fb-7389-9a74-94c039755ed1" })
  id!: string;

  @ApiProperty({ example: "DISP-1790000000000" })
  numeroAtendimento!: string;

  @ApiProperty({ example: "2026-10-21T10:30:00.000Z" })
  dataAtendimento!: string | Date;

  @ApiProperty({ example: "concluida", enum: ["concluida", "estornada"] })
  status!: "concluida" | "estornada";

  @ApiProperty({ example: "Carlos Silva" })
  pacienteNome!: string;

  @ApiProperty({ example: "12345678909" })
  pacienteCpf!: string;

  @ApiProperty({ example: "123456789012345" })
  pacienteCns!: string;

  @ApiProperty({ example: "Dra. Beatriz Santos" })
  dispensadorNome!: string;

  @ApiProperty({ example: 2 })
  totalItens!: number;

  @ApiProperty({ example: "Dipirona 500mg (20), Paracetamol 500mg (10)" })
  medicamentosResumo!: string;
}

export class DispensacoesPaginadasResponseDto
  implements DispensacoesPaginadasResultado
{
  @ApiProperty({ type: [DispensacaoItemListaResponseDto] })
  itens!: DispensacaoItemListaResponseDto[];

  @ApiProperty({ example: 15 })
  totalItens!: number;

  @ApiProperty({ example: 1 })
  pagina!: number;

  @ApiProperty({ example: 20 })
  limite!: number;

  @ApiProperty({ example: 1 })
  totalPaginas!: number;

  @ApiProperty({ example: "2026-10-20" })
  dataInicioEfetiva!: string;

  @ApiProperty({ example: "2026-10-21" })
  dataFimEfetiva!: string;
}

export class EstornarDispensacaoDto implements EstornarDispensacaoRequest {
  @ApiProperty({
    description: "Justificativa obrigatória do estorno (mínimo de 10 caracteres)",
    example: "Paciente desistiu da retirada após conferência no balcão",
    minLength: 10,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  motivoEstorno!: string;
}

export class EstornarDispensacaoResponseDto
  implements EstornarDispensacaoResultado
{
  @ApiProperty({ example: "0194e43e-a6fb-7389-9a74-94c039755ed1" })
  id!: string;

  @ApiProperty({ example: "estornada" })
  status!: "estornada";

  @ApiProperty({ example: "2026-10-21T14:00:00.000Z" })
  estornadoEm!: string | Date;

  @ApiProperty({ example: "Paciente desistiu da retirada" })
  motivoEstorno!: string;

  @ApiProperty()
  itensDevolvidos!: {
    loteId: string;
    numeroLote: string;
    quantidadeRestituida: number;
    novoSaldoLote: number;
  }[];
}

