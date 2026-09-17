import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import type { ListagemUsuariosResultado } from "@farmaubs/shared";
import { CadastrarUsuarioUseCase } from "../../application/use-cases/register-user.use-case";
import { ListUsersUseCase } from "../../application/use-cases/list-users.use-case";
import { EditUserUseCase } from "../../application/use-cases/edit-user.use-case";
import { UpdateAssociationsUseCase } from "../../application/use-cases/update-associations.use-case";
import { ToggleUserStatusUseCase } from "../../application/use-cases/toggle-user-status.use-case";
import { SetTemporaryPasswordUseCase } from "../../application/use-cases/set-temporary-password.use-case";

import { CadastrarUsuarioDto } from "../dto/create-user.dto";
import { ListUsersQueryDto } from "../dto/list-users-query.dto";
import { UsuarioCadastradoResponseDto } from "../dto/user-response.dto";
import { EditarUsuarioDto } from "../dto/edit-user.dto";
import { AtualizarAssociacoesUsuarioDto } from "../dto/update-associations.dto";
import { AlterarStatusUsuarioDto } from "../dto/toggle-status.dto";
import { RedefinirSenhaProvisoriaDto } from "../dto/set-temporary-password.dto";
import { UsuarioAtualizadoResponseDto } from "../dto/user-updated-response.dto";

import {
  DadosUsuarioInvalidosException,
  PerfilNaoEncontradoException,
  UnidadeSaudeInvalidaException,
  UsuarioEmailJaExisteException,
} from "../../domain/errors/user-registration.errors";
import {
  AutoInativacaoBloqueadaException,
  IntegridadeTerritorialException,
  SenhaInvalidaException,
  UltimoAdministradorException,
  UsuarioNaoEncontradoException,
} from "../../domain/errors/user-management.errors";
import { Roles } from "../../../../common/guards/roles.decorator";
import { RolesGuard } from "../../../../common/guards/roles.guard";
import { SkipTransaction } from "../../../../common/transaction/skip-transaction.decorator";

@ApiTags("Usuários")
@Controller("usuarios")
export class UserController {
  constructor(
    private readonly cadastrarUsuarioUseCase: CadastrarUsuarioUseCase,
    private readonly listUsersUseCase: ListUsersUseCase,
    private readonly editUserUseCase: EditUserUseCase,
    private readonly updateAssociationsUseCase: UpdateAssociationsUseCase,
    private readonly toggleUserStatusUseCase: ToggleUserStatusUseCase,
    private readonly setTemporaryPasswordUseCase: SetTemporaryPasswordUseCase,
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

  @Patch(":id")
  @UseGuards(RolesGuard)
  @Roles("ADMINISTRADOR")
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth("access-token")
  @ApiOperation({
    summary: "Edita dados cadastrais de um usuário (nome e e-mail)",
    description:
      "Permite ao administrador atualizar o nome completo e/ou o e-mail de um usuário existente. Garante unicidade de e-mail e gera log de auditoria (RF025, RF028).",
  })
  @ApiOkResponse({
    description: "Dados do usuário atualizados com sucesso.",
    type: UsuarioAtualizadoResponseDto,
  })
  @ApiBadRequestResponse({
    description: "Dados informados são inválidos.",
  })
  @ApiUnauthorizedResponse({
    description: "Não autorizado — token de autenticação ausente ou inválido.",
  })
  @ApiForbiddenResponse({
    description: "Acesso proibido — perfil sem permissão para este recurso.",
  })
  @ApiNotFoundResponse({
    description: "Usuário alvo não encontrado.",
  })
  @ApiConflictResponse({
    description: "E-mail informado já está em uso por outro usuário.",
  })
  async editar(
    @Param("id") id: string,
    @Body() dto: EditarUsuarioDto,
    @Req() req: any,
  ): Promise<UsuarioAtualizadoResponseDto> {
    const executorId = this.obterExecutorId(req);
    try {
      return await this.editUserUseCase.executar(executorId, id, dto);
    } catch (error) {
      if (error instanceof UsuarioNaoEncontradoException) {
        throw new NotFoundException(error.message);
      }
      if (error instanceof UsuarioEmailJaExisteException) {
        throw new ConflictException(error.message);
      }
      if (error instanceof DadosUsuarioInvalidosException) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }

  @Put(":id/associacoes")
  @UseGuards(RolesGuard)
  @Roles("ADMINISTRADOR")
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth("access-token")
  @ApiOperation({
    summary: "Atualiza perfil de acesso e vínculos de UBSs do usuário",
    description:
      "Sincroniza atomicamente o perfil RBAC e a lista de UBSs associadas ao usuário. Garante integridade territorial e protege contra demotores do último administrador ativo (RF001, RF025, RF026, RF028).",
  })
  @ApiOkResponse({
    description: "Associações atualizadas com sucesso.",
    type: UsuarioAtualizadoResponseDto,
  })
  @ApiBadRequestResponse({
    description:
      "Lista de UBSs vazia ou UBS pertencente a outro município (integridade territorial).",
  })
  @ApiUnauthorizedResponse({
    description: "Não autorizado — token de autenticação ausente ou inválido.",
  })
  @ApiForbiddenResponse({
    description: "Acesso proibido — perfil sem permissão para este recurso.",
  })
  @ApiNotFoundResponse({
    description: "Usuário alvo ou perfil não encontrado no catálogo.",
  })
  @ApiConflictResponse({
    description:
      "Tentativa de rebaixar o perfil do único administrador ativo do sistema.",
  })
  async atualizarAssociacoes(
    @Param("id") id: string,
    @Body() dto: AtualizarAssociacoesUsuarioDto,
    @Req() req: any,
  ): Promise<UsuarioAtualizadoResponseDto> {
    const executorId = this.obterExecutorId(req);
    try {
      return await this.updateAssociationsUseCase.executar(executorId, id, dto);
    } catch (error) {
      if (error instanceof UsuarioNaoEncontradoException) {
        throw new NotFoundException(error.message);
      }
      if (error instanceof PerfilNaoEncontradoException) {
        throw new NotFoundException(error.message);
      }
      if (error instanceof UnidadeSaudeInvalidaException) {
        throw new BadRequestException(error.message);
      }
      if (error instanceof IntegridadeTerritorialException) {
        throw new BadRequestException(error.message);
      }
      if (error instanceof UltimoAdministradorException) {
        throw new ConflictException(error.message);
      }
      throw error;
    }
  }

  @Patch(":id/status")
  @UseGuards(RolesGuard)
  @Roles("ADMINISTRADOR")
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth("access-token")
  @ApiOperation({
    summary: "Inativa ou reativa a conta de um usuário (soft delete)",
    description:
      "Altera o status ativo do usuário. Ao inativar, bloqueia auto-inativação, protege o último administrador ativo e revoga imediatamente todas as sessões ativas (RF002, RF004, RF025, RF028).",
  })
  @ApiOkResponse({
    description: "Status do usuário alterado com sucesso.",
    type: UsuarioAtualizadoResponseDto,
  })
  @ApiBadRequestResponse({
    description: "Dados da requisição inválidos.",
  })
  @ApiUnauthorizedResponse({
    description: "Não autorizado — token de autenticação ausente ou inválido.",
  })
  @ApiForbiddenResponse({
    description: "Acesso proibido — perfil sem permissão para este recurso.",
  })
  @ApiNotFoundResponse({
    description: "Usuário alvo não encontrado.",
  })
  @ApiConflictResponse({
    description:
      "Tentativa de auto-inativação ou inativação do único administrador ativo.",
  })
  async alterarStatus(
    @Param("id") id: string,
    @Body() dto: AlterarStatusUsuarioDto,
    @Req() req: any,
  ): Promise<UsuarioAtualizadoResponseDto> {
    const executorId = this.obterExecutorId(req);
    try {
      return await this.toggleUserStatusUseCase.executar(executorId, id, dto);
    } catch (error) {
      if (error instanceof UsuarioNaoEncontradoException) {
        throw new NotFoundException(error.message);
      }
      if (error instanceof AutoInativacaoBloqueadaException) {
        throw new ConflictException(error.message);
      }
      if (error instanceof UltimoAdministradorException) {
        throw new ConflictException(error.message);
      }
      throw error;
    }
  }

  @Post(":id/senha-provisoria")
  @UseGuards(RolesGuard)
  @Roles("ADMINISTRADOR")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth("access-token")
  @ApiOperation({
    summary: "Define uma senha provisória para o usuário",
    description:
      "Redefine a senha com BCrypt custo 12, força troca de senha no primeiro login, reseta contadores de falha/bloqueio e revoga todas as sessões ativas do usuário alvo (RF003, RF004, RF028, NF011).",
  })
  @ApiNoContentResponse({
    description: "Senha provisória definida com sucesso.",
  })
  @ApiBadRequestResponse({
    description:
      "A senha informada não atende aos requisitos mínimos de complexidade.",
  })
  @ApiUnauthorizedResponse({
    description: "Não autorizado — token de autenticação ausente ou inválido.",
  })
  @ApiForbiddenResponse({
    description: "Acesso proibido — perfil sem permissão para este recurso.",
  })
  @ApiNotFoundResponse({
    description: "Usuário alvo não encontrado.",
  })
  async redefinirSenhaProvisoria(
    @Param("id") id: string,
    @Body() dto: RedefinirSenhaProvisoriaDto,
    @Req() req: any,
  ): Promise<void> {
    const executorId = this.obterExecutorId(req);
    try {
      await this.setTemporaryPasswordUseCase.executar(executorId, id, dto);
    } catch (error) {
      if (error instanceof UsuarioNaoEncontradoException) {
        throw new NotFoundException(error.message);
      }
      if (error instanceof SenhaInvalidaException) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }

  private obterExecutorId(req: any): string {
    return (
      req?.sessao?.usuarioId ??
      req?.user?.usuarioId ??
      req?.user?.id ??
      "00000000-0000-0000-0000-000000000000"
    );
  }
}

export type UsuariosController = UserController;
