import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from "class-validator";
import type {
  DispensacaoEfetivadaResultado,
  EfetivarDispensacaoRequest,
  ItemDispensacaoRequest,
  ItemDispensadoResultadoDto,
  PacienteDispensacaoRequest,
} from "@farmaubs/shared";

export class PacienteDispensacaoDto implements PacienteDispensacaoRequest {
  @ApiPropertyOptional({
    description: "ID opcional caso o paciente já tenha sido selecionado da busca",
    example: "0194e43e-a6fb-7389-9a74-94c039755ef7",
  })
  @IsOptional()
  @IsUUID()
  id?: string;

  @ApiProperty({
    description: "CNS com 15 dígitos numéricos",
    example: "123456789012345",
  })
  @IsString()
  @IsNotEmpty()
  cns!: string;

  @ApiProperty({
    description: "CPF válido com 11 dígitos",
    example: "12345678909",
  })
  @IsString()
  @IsNotEmpty()
  cpf!: string;

  @ApiProperty({
    description: "Nome completo do paciente",
    example: "Carlos Silva",
  })
  @IsString()
  @IsNotEmpty()
  nomeCompleto!: string;

  @ApiProperty({
    description: "Data de nascimento no formato ISO (AAAA-MM-DD)",
    example: "1990-01-01",
  })
  @IsString()
  @IsNotEmpty()
  dataNascimento!: string;
}

export class ItemDispensacaoDto implements ItemDispensacaoRequest {
  @ApiProperty({
    description: "ID do medicamento",
    example: "0194e43e-a6fb-7389-9a74-94c039755ea1",
  })
  @IsUUID()
  @IsNotEmpty()
  medicamentoId!: string;

  @ApiProperty({
    description: "ID do lote físico na UBS",
    example: "0194e43e-a6fb-7389-9a74-94c039755eb1",
  })
  @IsUUID()
  @IsNotEmpty()
  loteId!: string;

  @ApiProperty({
    description: "Quantidade inteira positiva a dispensar",
    example: 20,
    minimum: 1,
  })
  @IsInt()
  @Min(1)
  quantidadeDispensada!: number;

  @ApiPropertyOptional({
    description: "Posologia prescrita ao paciente",
    example: "1 comprimido a cada 8 horas por 7 dias",
  })
  @IsOptional()
  @IsString()
  posologia?: string;
}

export class EfetivarDispensacaoDto implements EfetivarDispensacaoRequest {
  @ApiPropertyOptional({
    description:
      "UUID da UBS de atendimento. Se omitido, utiliza a primeira UBS vinculada ao usuário autenticado.",
    example: "0194e43e-a6fb-7389-9a74-94c039755ef5",
  })
  @IsOptional()
  @IsUUID()
  ubsId?: string;

  @ApiProperty({
    description: "Dados obrigatórios de identificação do paciente",
    type: PacienteDispensacaoDto,
  })
  @ValidateNested()
  @Type(() => PacienteDispensacaoDto)
  @IsNotEmpty()
  paciente!: PacienteDispensacaoDto;

  @ApiPropertyOptional({
    description:
      "Data de emissão da receita médica (AAAA-MM-DD), obrigatória e <= 10 dias para antimicrobianos",
    example: "2026-10-18",
  })
  @IsOptional()
  @IsString()
  receitaEmissaoEm?: string;

  @ApiProperty({
    description: "Lista de medicamentos e lotes a dispensar",
    type: [ItemDispensacaoDto],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ItemDispensacaoDto)
  itens!: ItemDispensacaoDto[];
}

export class ItemDispensadoResultadoResponseDto
  implements ItemDispensadoResultadoDto
{
  @ApiProperty({ example: "0194e43e-a6fb-7389-9a74-94c039755ec1" })
  itemId!: string;

  @ApiProperty({ example: "0194e43e-a6fb-7389-9a74-94c039755ea1" })
  medicamentoId!: string;

  @ApiProperty({ example: "Paracetamol 500mg" })
  medicamentoNome!: string;

  @ApiProperty({ example: "0194e43e-a6fb-7389-9a74-94c039755eb1" })
  loteId!: string;

  @ApiProperty({ example: "LOT-01" })
  numeroLote!: string;

  @ApiProperty({ example: 20 })
  quantidadeDispensada!: number;

  @ApiProperty({ example: 30 })
  saldoRestanteLote!: number;
}

export class DispensacaoEfetivadaResponseDto
  implements DispensacaoEfetivadaResultado
{
  @ApiProperty({ example: "0194e43e-a6fb-7389-9a74-94c039755ed1" })
  id!: string;

  @ApiProperty({ example: "DISP-1790000000000" })
  numeroAtendimento!: string;

  @ApiProperty({ example: "2026-10-21T12:00:00.000Z" })
  dataAtendimento!: string | Date;

  @ApiProperty({ example: "concluida", enum: ["concluida", "estornada"] })
  status!: "concluida" | "estornada";

  @ApiProperty()
  paciente!: {
    id: string;
    nomeCompleto: string;
    cpf: string;
    cns: string;
  };

  @ApiProperty()
  dispensador!: {
    id: string;
    nomeCompleto: string;
  };

  @ApiProperty({ type: [ItemDispensadoResultadoResponseDto] })
  itens!: ItemDispensadoResultadoResponseDto[];
}

