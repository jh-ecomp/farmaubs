import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsEmail,
  IsNotEmpty,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';
import { CadastrarUsuarioComando } from '@farmaubs/shared';

export class CadastrarUsuarioDto implements CadastrarUsuarioComando {
  @ApiProperty({
    description:
      'Identificador único (UUID) do município ao qual o usuário pertence',
    example: '01919a77-3e15-7000-8000-000000000001',
  })
  @IsUUID()
  @IsNotEmpty()
  municipioId!: string;

  @ApiProperty({
    description: 'Nome completo do usuário',
    example: 'Carlos Eduardo da Silva',
  })
  @IsString()
  @IsNotEmpty()
  nomeCompleto!: string;

  @ApiProperty({
    description:
      'E-mail corporativo ou institucional do usuário (chave única, insensível à caixa)',
    example: 'carlos.silva@ubs.gov.br',
  })
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @ApiProperty({
    description: 'Senha de acesso inicial (mínimo de 8 caracteres)',
    example: 'SenhaForte#2026',
    minLength: 8,
    format: 'password',
  })
  @IsString()
  @MinLength(8)
  @IsNotEmpty()
  senha!: string;

  @ApiProperty({
    description:
      'Identificador (UUID) ou código natural do perfil RBAC (ex: FARMACEUTICO, MEDICO, ENFERMEIRO)',
    example: 'FARMACEUTICO',
  })
  @IsString()
  @IsNotEmpty()
  perfil!: string;

  @ApiProperty({
    description:
      'Lista de identificadores (UUIDs) das Unidades Básicas de Saúde vinculadas ao usuário',
    example: ['01919a77-3e15-7000-8000-000000000010'],
    type: [String],
  })
  @IsArray()
  @IsUUID('all', { each: true })
  @IsNotEmpty({ each: true })
  ubsIds!: string[];
}

export type CreateUserDto = CadastrarUsuarioDto;
