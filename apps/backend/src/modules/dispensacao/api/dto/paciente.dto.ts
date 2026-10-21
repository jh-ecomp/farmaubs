import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsNotEmpty, IsOptional, IsString } from "class-validator";
import type {
  CadastrarPacienteRequest,
  HistoricoPacienteResultado,
  ItemHistoricoConsumoDto,
  PacienteDto,
} from "@farmaubs/shared";

export class CadastrarPacienteDto implements CadastrarPacienteRequest {
  @ApiProperty({
    description:
      "Cartão Nacional de Saúde (CNS) com exatamente 15 dígitos numéricos",
    example: "123456789012345",
  })
  @IsString()
  @IsNotEmpty()
  cns!: string;

  @ApiProperty({
    description: "CPF com 11 dígitos numéricos válidos (com ou sem pontuação)",
    example: "12345678909",
  })
  @IsString()
  @IsNotEmpty()
  cpf!: string;

  @ApiProperty({
    description: "Nome completo do paciente (entre 3 e 150 caracteres)",
    example: "Maria Souza",
  })
  @IsString()
  @IsNotEmpty()
  nomeCompleto!: string;

  @ApiProperty({
    description: "Data de nascimento no formato ISO (AAAA-MM-DD)",
    example: "1985-04-12",
  })
  @IsString()
  @IsNotEmpty()
  dataNascimento!: string;
}

export class BuscarPacientesQueryDto {
  @ApiPropertyOptional({
    description:
      "Fragmento de CPF, CNS ou nome do paciente para pesquisa rápida",
    example: "Maria",
  })
  @IsOptional()
  @IsString()
  termo?: string;
}

export class PacienteResponseDto implements PacienteDto {
  @ApiProperty({
    description: "Identificador único (UUIDv7) do paciente",
    example: "0194e43e-a6fb-7389-9a74-94c039755ef7",
  })
  id!: string;

  @ApiProperty({
    description: "Identificador do município ao qual o cadastro pertence",
    example: "0194e43e-a6fb-7389-9a74-94c039755ef0",
  })
  municipioId!: string;

  @ApiProperty({
    description: "CNS do paciente",
    example: "123456789012345",
  })
  cns!: string;

  @ApiProperty({
    description: "CPF do paciente (apenas dígitos)",
    example: "12345678909",
  })
  cpf!: string;

  @ApiProperty({
    description: "Nome completo do paciente",
    example: "Maria Souza",
  })
  nomeCompleto!: string;

  @ApiProperty({
    description: "Data de nascimento (AAAA-MM-DD)",
    example: "1985-04-12",
  })
  dataNascimento!: string;

  @ApiProperty({
    description: "Status ativo do cadastro",
    example: true,
  })
  ativo!: boolean;

  @ApiProperty({
    description: "Data/hora do cadastro",
    example: "2026-10-18T18:00:00.000Z",
  })
  criadoEm!: string | Date;
}

export class ItemHistoricoConsumoResponseDto implements ItemHistoricoConsumoDto {
  @ApiProperty({
    description: "ID da dispensação",
    example: "0194e43e-a6fb-7389-9a74-94c039755ef1",
  })
  dispensacaoId!: string;

  @ApiProperty({
    description: "Data/hora da dispensação realizada",
    example: "2026-10-06T14:30:00.000Z",
  })
  dataDispensacao!: string | Date;

  @ApiProperty({
    description: "ID do medicamento retirado",
    example: "0194e43e-a6fb-7389-9a74-94c039755ef2",
  })
  medicamentoId!: string;

  @ApiProperty({
    description: "Nome do medicamento dispensado",
    example: "Losartana 50mg",
  })
  medicamentoNome!: string;

  @ApiProperty({
    description: "Quantidade física dispensada",
    example: 30,
  })
  quantidadeDispensada!: number;

  @ApiPropertyOptional({
    description: "Posologia prescrita",
    example: "1 comprimido ao dia",
  })
  posologia?: string;

  @ApiProperty({
    description: "Quantidade de dias decorridos desde a retirada",
    example: 12,
  })
  diasDesdeUltimaRetirada!: number;

  @ApiProperty({
    description: "Indica se houve tentativa de retirada antecipada (< 25 dias)",
    example: true,
  })
  possivelUsoIrracional!: boolean;
}

export class HistoricoPacienteResponseDto implements HistoricoPacienteResultado {
  @ApiProperty({
    description: "Cadastro do paciente",
    type: PacienteResponseDto,
  })
  paciente!: PacienteResponseDto;

  @ApiProperty({
    description: "Histórico de retiradas dos últimos 90 dias",
    type: [ItemHistoricoConsumoResponseDto],
  })
  itensConsumo!: ItemHistoricoConsumoResponseDto[];
}

