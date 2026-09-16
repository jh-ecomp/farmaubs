import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import type { ListagemUsuariosResultado } from "@farmaubs/shared";
import { CadastrarUsuarioUseCase } from "../../application/use-cases/register-user.use-case";
import { ListUsersUseCase } from "../../application/use-cases/list-users.use-case";
import { CadastrarUsuarioDto } from "../dto/create-user.dto";
import { ListUsersQueryDto } from "../dto/list-users-query.dto";
import { UsuarioCadastradoResponseDto } from "../dto/user-response.dto";
import {
  DadosUsuarioInvalidosException,
  PerfilNaoEncontradoException,
  UnidadeSaudeInvalidaException,
  UsuarioEmailJaExisteException,
} from "../../domain/errors/user-registration.errors";
import { Roles } from "../../../../common/guards/roles.decorator";
import { RolesGuard } from "../../../../common/guards/roles.guard";
import { SkipTransaction } from "../../../../common/transaction/skip-transaction.decorator";

@ApiTags("Usuários")
@Controller("usuarios")
export class UserController {
  constructor(
    private readonly cadastrarUsuarioUseCase: CadastrarUsuarioUseCase,
    private readonly listUsersUseCase: ListUsersUseCase,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: "Cadastra um novo usuário no sistema",
    description:
      "Cria um novo usuário vinculado a um município, com perfil de acesso RBAC (ADR-006) e vínculo de UBSs (RF001). A senha é protegida com hash BCrypt custo 12 (NF011) e uma notificação de e-mail é disparada.",
  })
  @ApiCreatedResponse({
    description: "Usuário cadastrado com sucesso.",
    type: UsuarioCadastradoResponseDto,
  })
  @ApiBadRequestResponse({
    description:
      "Dados de usuário inválidos, campos obrigatórios ausentes ou UBS não pertencente ao município.",
  })
  @ApiNotFoundResponse({
    description: "Perfil de acesso não encontrado ou inativo no catálogo.",
  })
  @ApiConflictResponse({
    description: "Já existe um usuário cadastrado com o e-mail informado.",
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

  @Get()
  @UseGuards(RolesGuard)
  @Roles("ADMINISTRADOR")
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth("access-token")
  @ApiOperation({
    summary: "Lista usuários do sistema de forma paginada e filtrada",
    description:
      "Retorna listagem paginada de usuários para o painel administrativo. Acesso restrito exclusivamente ao perfil ADMINISTRADOR (ADR-006, RF025, NF009). A senha hash nunca é exposta.",
  })
  @ApiOkResponse({
    description: "Listagem de usuários retornada com sucesso.",
  })
  @ApiUnauthorizedResponse({
    description: "Não autorizado — token de autenticação ausente ou inválido.",
  })
  @ApiForbiddenResponse({
    description: "Acesso proibido — perfil sem permissão para este recurso.",
  })
  async listar(
    @Query() query: ListUsersQueryDto,
  ): Promise<ListagemUsuariosResultado> {
    return this.listUsersUseCase.executar(query);
  }
}

export type UsuariosController = UserController;
