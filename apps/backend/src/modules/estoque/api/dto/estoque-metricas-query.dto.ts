import { ApiProperty } from "@nestjs/swagger";
import { IsUUID } from "class-validator";

export class EstoqueMetricasQueryDto {
  @ApiProperty({
    format: "uuid",
    description: "UBS consultada (deve estar no escopo do usuário).",
  })
  @IsUUID()
  unidadeId!: string;
}
