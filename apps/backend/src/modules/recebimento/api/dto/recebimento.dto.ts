import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from "class-validator";
import {
  AvisoRecebimentoDto,
  CriarEntradaEstoqueRequest,
  EntradaEstoqueEfetivadaResultado,
  ItemRecebimentoEntrada,
  ItemRecebimentoResultadoDto,
  TipoDocumentoEntradaEnum,
} from "@farmaubs/shared";

export class ItemRecebimentoEntradaDto implements ItemRecebimentoEntrada {
  @ApiProperty({
    description: "UUID do medicamento cadastrado no catálogo",
    example: "0194e43e-a6fb-7389-9a74-94c039755ef0",
  })
  @IsUUID("4", { message: "O produtoId deve ser um UUID válido." })
  produtoId: string;

  @ApiProperty({
    description: "UUID do fabricante do lote cadastrado",
    example: "0194e43e-a6fb-7389-9a74-94c039755ef1",
  })
  @IsUUID("4", { message: "O fabricanteId deve ser um UUID válido." })
  fabricanteId: string;

  @ApiProperty({
    description: "Código ou número do lote impresso na embalagem",
    example: "LOT-2026-X4",
    minLength: 2,
    maxLength: 60,
  })
  @IsString({ message: "O número do lote é obrigatório." })
  @MinLength(2, { message: "O número do lote deve ter ao menos 2 caracteres." })
  @MaxLength(60, { message: "O número do lote não pode exceder 60 caracteres." })
  numeroLote: string;

  @ApiProperty({
    description: "Data de validade do lote no formato ISO YYYY-MM-DD",
    example: "2027-12-31",
  })
  @IsDateString(
    {},
    { message: "A data de validade deve ser uma data válida no formato YYYY-MM-DD." },
  )
  dataValidade: string;

  @ApiProperty({
    description: "Quantidade física recebida em unidades de fornecimento",
    example: 500,
    minimum: 1,
  })
  @IsInt({ message: "A quantidade recebida deve ser um número inteiro." })
  @Min(1, { message: "A quantidade recebida deve ser de no mínimo 1 unidade." })
  quantidadeRecebida: number;

  @ApiPropertyOptional({
    description: "Observações específicas deste item",
    example: "Caixa lacrada e em perfeito estado",
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  observacoes?: string | null;
}

export class CriarEntradaEstoqueDto implements CriarEntradaEstoqueRequest {
  @ApiPropertyOptional({
    description: "UUID da UBS de destino. Se omitido, utiliza a UBS padrão do usuário autenticado.",
    example: "0194e43e-a6fb-7389-9a74-94c039755ef5",
  })
  @IsOptional()
  @IsUUID("4", { message: "O ubsId deve ser um UUID válido." })
  ubsId?: string;

  @ApiProperty({
    description: "Número da nota fiscal ou código da guia de remessa CAF",
    example: "GUIA-CAF-2026/104",
    minLength: 2,
    maxLength: 100,
  })
  @IsString({ message: "O número do documento é obrigatório." })
  @MinLength(2, {
    message: "O número do documento deve ter ao menos 2 caracteres.",
  })
  @MaxLength(100, {
    message: "O número do documento não pode exceder 100 caracteres.",
  })
  numeroDocumento: string;

  @ApiProperty({
    description: "Tipo oficial do documento de origem da carga",
    enum: TipoDocumentoEntradaEnum,
    example: TipoDocumentoEntradaEnum.GUIA_CAF,
  })
  @IsEnum(TipoDocumentoEntradaEnum, {
    message: "Tipo de documento de entrada inválido.",
  })
  tipoDocumento: string;

  @ApiProperty({
    description: "Identificação da origem ou fornecedor da remessa",
    example: "CAF Central Parnaíba",
    minLength: 3,
    maxLength: 180,
  })
  @IsString({ message: "O fornecedor ou origem é obrigatório." })
  @MinLength(3, {
    message: "O fornecedor ou origem deve ter ao menos 3 caracteres.",
  })
  @MaxLength(180, {
    message: "O fornecedor ou origem não pode exceder 180 caracteres.",
  })
  fornecedorOrigem: string;

  @ApiPropertyOptional({
    description: "Data/hora da conferência física (padrão: agora)",
    example: "2026-10-21T18:00:00.000Z",
  })
  @IsOptional()
  @IsDateString()
  dataRecebimento?: string | null;

  @ApiPropertyOptional({
    description: "Observações gerais sobre a entrega da carga",
    example: "Remessa entregue com conferência física conferida por farmacêutico.",
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  observacoes?: string | null;

  @ApiProperty({
    description: "Lista de itens de medicamentos recebidos na carga",
    type: [ItemRecebimentoEntradaDto],
  })
  @IsArray({ message: "A lista de itens deve ser um array." })
  @ArrayMinSize(1, { message: "A entrada deve conter ao menos um item de medicamento." })
  @ValidateNested({ each: true })
  @Type(() => ItemRecebimentoEntradaDto)
  itens: ItemRecebimentoEntradaDto[];
}

export class EntradaEstoqueEfetivadaSwaggerResponse
  implements EntradaEstoqueEfetivadaResultado
{
  @ApiProperty({ example: "0194e43e-a6fb-7389-9a74-94c039755ef0" })
  id: string;

  @ApiProperty({ example: "GUIA-CAF-2026/104" })
  numeroDocumento: string;

  @ApiProperty({ example: "GUIA_CAF" })
  tipoDocumento: string;

  @ApiProperty({ example: "CAF Central Parnaíba" })
  fornecedorOrigem: string;

  @ApiProperty({ example: "2026-10-21T18:00:00.000Z" })
  dataRecebimento: Date;

  @ApiProperty({ example: "0194e43e-a6fb-7389-9a74-94c039755ef2" })
  usuarioRecebedorId: string;

  @ApiProperty({
    type: "array",
    items: {
      type: "object",
      properties: {
        itemId: { type: "string" },
        produtoId: { type: "string" },
        produtoNome: { type: "string" },
        fabricanteId: { type: "string" },
        fabricanteNome: { type: "string" },
        loteId: { type: "string" },
        numeroLote: { type: "string" },
        dataValidade: { type: "string" },
        quantidadeRecebida: { type: "number" },
        saldoFinalLote: { type: "number" },
      },
    },
  })
  itens: ItemRecebimentoResultadoDto[];

  @ApiProperty({
    type: "array",
    items: {
      type: "object",
      properties: {
        tipo: { type: "string" },
        lote: { type: "string" },
        mensagem: { type: "string" },
      },
    },
  })
  avisos: AvisoRecebimentoDto[];
}
