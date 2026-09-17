import { ApiProperty } from "@nestjs/swagger";
import { IsArray, IsNotEmpty, IsString, IsUUID } from "class-validator";
import type { AtualizarAssociacoesUsuarioComando } from "@farmaubs/shared";

export class AtualizarAssociacoesUsuarioDto implements AtualizarAssociacoesUsuarioComando {
  @ApiProperty({
    description:
      "Identificador único (UUID) ou código natural do novo perfil atribuído",
    example: "01919a77-3e15-7000-8000-000000000005",
  })
  @IsString()
  @IsNotEmpty()
  perfilId!: string;

  @ApiProperty({
    description:
      "Lista de identificadores (UUIDs) das Unidades Básicas de Saúde vinculadas",
    example: ["01919a77-3e15-7000-8000-000000000010"],
    type: [String],
  })
  @IsArray()
  @IsUUID("all", { each: true })
  @IsNotEmpty({ each: true })
  ubsIds!: string[];
}

export type UpdateAssociationsDto = AtualizarAssociacoesUsuarioDto;
