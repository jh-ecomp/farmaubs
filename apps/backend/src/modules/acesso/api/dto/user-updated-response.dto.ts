import { ApiProperty } from "@nestjs/swagger";
import type { UsuarioAtualizadoResultado } from "@farmaubs/shared";

export class UsuarioAtualizadoResponseDto implements UsuarioAtualizadoResultado {
  @ApiProperty({
    description: "Identificador único (UUID) do usuário",
    example: "01919a77-3e15-7000-8000-000000000020",
  })
  id!: string;

  @ApiProperty({
    description: "Identificador único (UUID) do município do usuário",
    example: "01919a77-3e15-7000-8000-000000000001",
  })
  municipioId!: string;

  @ApiProperty({
    description: "Nome completo atualizado do usuário",
    example: "Carlos Eduardo da Silva",
  })
  nomeCompleto!: string;

  @ApiProperty({
    description: "E-mail do usuário normalizado",
    example: "carlos.silva@ubs.gov.br",
  })
  email!: string;

  @ApiProperty({
    description: "Identificador único (UUID) do perfil de acesso atribuído",
    example: "01919a77-3e15-7000-8000-000000000005",
  })
  perfilId!: string;

  @ApiProperty({
    description: "Status ativo do usuário no sistema",
    example: true,
  })
  ativo!: boolean;

  @ApiProperty({
    description:
      "Flag indicando se o usuário deve trocar a senha no próximo acesso",
    example: true,
  })
  deveTrocarSenha!: boolean;

  @ApiProperty({
    description: "Lista de UUIDs das UBSs associadas ao usuário",
    example: ["01919a77-3e15-7000-8000-000000000010"],
    type: [String],
  })
  ubsIds!: string[];

  @ApiProperty({
    description: "Data e hora da última atualização do registro",
    example: "2026-09-17T14:30:00.000Z",
  })
  atualizadoEm!: Date;
}

export type UserUpdatedResponseDto = UsuarioAtualizadoResponseDto;
