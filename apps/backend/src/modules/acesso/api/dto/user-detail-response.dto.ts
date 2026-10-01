import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import type {
  UsuarioDetalheDto,
  UsuarioDetalheUbsDto,
  PerfilCodigo,
} from "@farmaubs/shared";

export class UsuarioDetalheUbsResponseDto implements UsuarioDetalheUbsDto {
  @ApiProperty({
    description: "Identificador único da unidade de saúde (UUID)",
    example: "01919a77-3e15-7000-8000-000000000010",
  })
  id!: string;

  @ApiProperty({
    description: "Código Nacional de Estabelecimentos de Saúde (CNES)",
    example: "2401824",
  })
  cnes!: string;

  @ApiProperty({
    description: "Nome da UBS",
    example: "UBS Frei Higino",
  })
  nome!: string;

  @ApiProperty({
    description: "Indica se o vínculo da UBS está ativo",
    example: true,
  })
  ativo!: boolean;
}

export class UsuarioDetalheMunicipioResponseDto {
  @ApiProperty({
    description: "Identificador único do município (UUID)",
    example: "01919a77-3e15-7000-8000-000000000001",
  })
  id!: string;

  @ApiProperty({
    description: "Nome do município",
    example: "Parnaíba",
  })
  nome!: string;

  @ApiProperty({
    description: "Sigla da Unidade Federativa (UF)",
    example: "PI",
  })
  uf!: string;
}

export class UsuarioDetalhePerfilResponseDto {
  @ApiProperty({
    description: "Identificador único do perfil (UUID)",
    example: "01919a77-3e15-7000-8000-000000000002",
  })
  id!: string;

  @ApiProperty({
    description: "Código canônico do perfil RBAC",
    example: "ADMINISTRADOR",
  })
  codigo!: PerfilCodigo | string;

  @ApiProperty({
    description: "Nome legível do perfil",
    example: "Administrador",
  })
  nome!: string;
}

export class UserDetailResponseDto implements UsuarioDetalheDto {
  @ApiProperty({
    description: "Identificador único do usuário (UUID)",
    example: "01919a77-3e15-7000-8000-000000000000",
  })
  id!: string;

  @ApiProperty({
    description: "Nome completo do usuário",
    example: "Carlos Eduardo da Silva",
  })
  nomeCompleto!: string;

  @ApiProperty({
    description: "Endereço de e-mail institucional",
    example: "carlos.silva@ubs.gov.br",
  })
  email!: string;

  @ApiProperty({
    description: "Indica se o usuário está ativo no sistema",
    example: true,
  })
  ativo!: boolean;

  @ApiProperty({
    description: "Indica se o usuário deve trocar de senha no próximo acesso",
    example: false,
  })
  deveTrocarSenha!: boolean;

  @ApiProperty({
    description: "Dados do município de lotação",
    type: UsuarioDetalheMunicipioResponseDto,
  })
  municipio!: UsuarioDetalheMunicipioResponseDto;

  @ApiProperty({
    description: "Perfil de acesso atribuído",
    type: UsuarioDetalhePerfilResponseDto,
  })
  perfil!: UsuarioDetalhePerfilResponseDto;

  @ApiProperty({
    description: "Lista de UBSs associadas ao usuário",
    type: [UsuarioDetalheUbsResponseDto],
  })
  unidadesSaude!: UsuarioDetalheUbsResponseDto[];

  @ApiPropertyOptional({
    description: "Lista de UBSs associadas (alias ubsList)",
    type: [UsuarioDetalheUbsResponseDto],
  })
  ubsList?: UsuarioDetalheUbsResponseDto[];

  @ApiPropertyOptional({
    description: "Data e hora do último login realizado",
    example: "2026-09-24T12:00:00.000Z",
    nullable: true,
  })
  ultimoLoginEm?: Date | string | null;

  @ApiProperty({
    description: "Data e hora de criação do cadastro",
    example: "2026-09-10T10:00:00.000Z",
  })
  criadoEm!: Date | string;

  @ApiProperty({
    description: "Data e hora da última atualização cadastral",
    example: "2026-09-24T12:00:00.000Z",
  })
  atualizadoEm!: Date | string;
}

export type UsuarioDetalheResponseDto = UserDetailResponseDto;
