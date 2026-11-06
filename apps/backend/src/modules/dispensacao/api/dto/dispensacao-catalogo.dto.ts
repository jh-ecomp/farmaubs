import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString, IsUUID } from "class-validator";
import type {
  LoteDisponivelDto,
  MedicamentoBuscaDto,
  SugestaoFefoResultado,
} from "@farmaubs/shared";

export class BuscarMedicamentosQueryDto {
  @ApiPropertyOptional({
    description:
      "Fragmento de nome comercial, princípio ativo ou apresentação do medicamento",
    example: "amox",
  })
  @IsOptional()
  @IsString()
  termo?: string;

  @ApiPropertyOptional({
    description:
      "UUID da UBS de consulta. Se omitido, utiliza a primeira UBS vinculada ao usuário autenticado.",
    example: "0194e43e-a6fb-7389-9a74-94c039755ef5",
  })
  @IsOptional()
  @IsUUID()
  ubsId?: string;
}

export class MedicamentoBuscaResponseDto implements MedicamentoBuscaDto {
  @ApiProperty({
    description: "ID único do medicamento",
    example: "0194e43e-a6fb-7389-9a74-94c039755ea1",
  })
  id!: string;

  @ApiProperty({
    description: "Princípio ativo (DCB)",
    example: "Amoxicilina",
  })
  principioAtivo!: string;

  @ApiPropertyOptional({
    description: "Nome comercial de referência",
    example: "Amoxil",
  })
  nomeComercial?: string;

  @ApiProperty({
    description: "Apresentação e concentração farmacêutica",
    example: "Cápsula 500mg",
  })
  apresentacao!: string;

  @ApiProperty({
    description: "Categoria terapêutica ou regulatória",
    example: "ANTIMICROBIANO",
  })
  categoria!: string;

  @ApiProperty({
    description:
      "Indica se é antimicrobiano sujeito a retenção/controle de receita",
    example: true,
  })
  antimicrobiano!: boolean;

  @ApiPropertyOptional({
    description: "Indica se exige preenchimento da data da receita médica",
    example: true,
  })
  requerDataReceita?: boolean;

  @ApiProperty({
    description: "Saldo físico consolidado disponível na UBS atual",
    example: 150,
  })
  saldoTotalUbs!: number;
}

export class LoteDisponivelResponseDto implements LoteDisponivelDto {
  @ApiProperty({
    description: "ID único do lote",
    example: "0194e43e-a6fb-7389-9a74-94c039755eb1",
  })
  id!: string;

  @ApiProperty({
    description: "Código alfanumérico do lote físico",
    example: "LOTE-B",
  })
  numeroLote!: string;

  @ApiProperty({
    description: "Data de validade no formato ISO (AAAA-MM-DD)",
    example: "2026-10-15",
  })
  dataValidade!: string;

  @ApiProperty({
    description: "Quantidade disponível em estoque na UBS",
    example: 50,
  })
  saldoDisponivel!: number;

  @ApiProperty({
    description:
      "Indica se este é o lote prioritário sugerido pelo algoritmo FEFO",
    example: true,
  })
  sugeridoFefo!: boolean;

  @ApiProperty({
    description: "Dias restantes até o vencimento",
    example: 25,
  })
  diasParaVencimento!: number;

  @ApiProperty({
    description: "Alerta de urgência para lotes com vencimento em até 30 dias",
    example: true,
  })
  alertaValidadeCurta!: boolean;

  @ApiProperty({
    description:
      "Indica se o lote está vencido e bloqueado para sugestão de saída",
    example: false,
  })
  vencido!: boolean;
}

export class SugestaoFefoResponseDto implements SugestaoFefoResultado {
  @ApiProperty({
    description: "Dados do medicamento selecionado",
    type: MedicamentoBuscaResponseDto,
  })
  medicamento!: MedicamentoBuscaResponseDto;

  @ApiPropertyOptional({
    description:
      "Lote prioritário sugerido por FEFO (null se não houver lote apto)",
    type: LoteDisponivelResponseDto,
    nullable: true,
  })
  loteSugerido!: LoteDisponivelResponseDto | null;

  @ApiProperty({
    description:
      "Lista completa de lotes em estoque na UBS ordenados por validade crescente",
    type: [LoteDisponivelResponseDto],
  })
  lotesDisponiveis!: LoteDisponivelResponseDto[];
}
