import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Post,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CadastrarUsuarioUseCase } from '../../application/use-cases/register-user.use-case';
import { CadastrarUsuarioDto } from '../dto/create-user.dto';
import { UsuarioCadastradoResponseDto } from '../dto/user-response.dto';
import {
  DadosUsuarioInvalidosException,
  PerfilNaoEncontradoException,
  UnidadeSaudeInvalidaException,
  UsuarioEmailJaExisteException,
} from '../../domain/errors/user-registration.errors';

@ApiTags('Usuários')
@Controller('usuarios')
export class UserController {
  constructor(
    private readonly cadastrarUsuarioUseCase: CadastrarUsuarioUseCase,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Cadastra um novo usuário no sistema',
    description:
      'Cria um novo usuário vinculado a um município, com perfil de acesso RBAC (ADR-006) e vínculo de UBSs (RF001). A senha é protegida com hash BCrypt custo 12 (NF011) e uma notificação de e-mail é disparada.',
  })
  @ApiCreatedResponse({
    description: 'Usuário cadastrado com sucesso.',
    type: UsuarioCadastradoResponseDto,
  })
  @ApiBadRequestResponse({
    description:
      'Dados de usuário inválidos, campos obrigatórios ausentes ou UBS não pertencente ao município.',
  })
  @ApiNotFoundResponse({
    description: 'Perfil de acesso não encontrado ou inativo no catálogo.',
  })
  @ApiConflictResponse({
    description: 'Já existe um usuário cadastrado com o e-mail informado.',
  })
  async cadastrar(
    @Body() dto: CadastrarUsuarioDto,
  ): Promise<UsuarioCadastradoResponseDto> {
    try {
      const resultado = await this.cadastrarUsuarioUseCase.executar(dto);
      return resultado;
    } catch (error) {
      if (error instanceof UsuarioEmailJaExisteException) {
        throw new ConflictException(error.message);
      }
      if (error instanceof PerfilNaoEncontradoException) {
        throw new NotFoundException(error.message);
      }
      if (error instanceof UnidadeSaudeInvalidaException) {
        throw new BadRequestException(error.message);
      }
      if (error instanceof DadosUsuarioInvalidosException) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }
}

export type UsuariosController = UserController;
