import { ApiProperty } from "@nestjs/swagger";
import {
  IsIn,
  IsInt,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";
import {
  JUSTIFICATIVA_AJUSTE_MAX,
  JUSTIFICATIVA_AJUSTE_MIN,
  MOTIVOS_AJUSTE,
  TIPOS_OPERACAO_AJUSTE,
  type MotivoAjuste,
  type RegistrarAjusteLoteInputDto,
  type TipoOperacaoAjuste,
} from "@farmaubs/shared";

/**
 * [RF009 / RF011]: Corpo do POST /estoque/lotes/:loteId/ajustes.
 * A compatibilidade motivo x tipo e o mínimo de 20 caracteres para OUTRO são validados no caso de uso.
 */
export class RegistrarAjusteEstoqueDto implements RegistrarAjusteLoteInputDto {
  @ApiProperty({ enum: TIPOS_OPERACAO_AJUSTE, example: "ENTRADA" })
  @IsIn([...TIPOS_OPERACAO_AJUSTE])
  tipoOperacao: TipoOperacaoAjuste;

  @ApiProperty({ example: 10, minimum: 1 })
  @IsInt()
  @Min(1, {
    message: "A quantidade deve ser um número inteiro estritamente positivo",
  })
  @Max(2147483647) // limite do integer do PostgreSQL
  quantidade: number;

  @ApiProperty({ enum: MOTIVOS_AJUSTE, example: "DEVOLUCAO_PACIENTE" })
  @IsIn([...MOTIVOS_AJUSTE])
  motivo: MotivoAjuste;

  @ApiProperty({
    minLength: JUSTIFICATIVA_AJUSTE_MIN,
    maxLength: JUSTIFICATIVA_AJUSTE_MAX,
    example: "Paciente devolveu 10 comprimidos lacrados por suspensão médica",
  })
  @IsString()
  @MinLength(JUSTIFICATIVA_AJUSTE_MIN, {
    message: `A justificativa deve conter no mínimo ${JUSTIFICATIVA_AJUSTE_MIN} caracteres`,
  })
  @MaxLength(JUSTIFICATIVA_AJUSTE_MAX)
  justificativa: string;
}
