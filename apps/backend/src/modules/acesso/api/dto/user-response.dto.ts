import { ApiProperty } from '@nestjs/swagger';
import { CadastrarUsuarioResultado } from '@farmaubs/shared';

export class UsuarioCadastradoResponseDto implements CadastrarUsuarioResultado {
  @ApiProperty({
    description: 'Identificador único (UUID) do usuário gerado pelo sistema',
    example: '01919a77-3e15-7000-8000-000000000020',
  })
  id!: string;

  @ApiProperty({
    description: 'Identificador único (UUID) do município do usuário',
    example: '01919a77-3e15-7000-8000-000000000001',
  })
  municipioId!: string;

  @ApiProperty({
    description: 'Nome completo do usuário cadastrado',
    example: 'Carlos Eduardo da Silva',
  })
  nomeCompleto!: string;

  @ApiProperty({
    description: 'E-mail do usuário normalizado em letras minúsculas',
    example: 'carlos.silva@ubs.gov.br',
  })
  email!: string;

  @ApiProperty({
    description: 'Identificador único (UUID) do perfil de acesso atribuído',
    example: '01919a77-3e15-7000-8000-000000000005',
  })
  perfilId!: string;

  @ApiProperty({
    description: 'Indica se a conta do usuário está ativa no sistema',
    example: true,
  })
  ativo!: boolean;

  @ApiProperty({
    description:
      'Indica se o usuário deve obrigatoriamente redefinir a senha no primeiro acesso',
    example: true,
  })
  deveTrocarSenha!: boolean;

  @ApiProperty({
    description: 'Lista de UUIDs das UBSs associadas ao usuário',
    example: ['01919a77-3e15-7000-8000-000000000010'],
    type: [String],
  })
  ubsIds!: string[];

  @ApiProperty({
    description: 'Data e hora em que o registro foi criado no sistema',
    example: '2026-09-10T14:30:00.000Z',
  })
  criadoEm!: Date;

  createdAt?: Date;
}

export type UserResponseDto = UsuarioCadastradoResponseDto;
