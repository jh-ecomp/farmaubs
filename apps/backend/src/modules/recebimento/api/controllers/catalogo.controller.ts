import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
} from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { PerfilCodigo } from "@farmaubs/shared";
import { Roles } from "../../../../common/decorators/roles.decorator";
import { SkipTransaction } from "../../../../common/transaction/skip-transaction.decorator";
import { BuscarProdutosCatalogoUseCase } from "../../application/use-cases/buscar-produtos-catalogo.use-case";
import { ListarFabricantesUseCase } from "../../application/use-cases/listar-fabricantes.use-case";
import { CadastrarFabricanteUseCase } from "../../application/use-cases/cadastrar-fabricante.use-case";
import {
  BuscaProdutoCatalogoQueryDto,
  CriarFabricanteDto,
  FabricanteSwaggerResponse,
  ProdutoCatalogoSwaggerResponse,
} from "../dto/catalogo.dto";
import {
  FabricanteCnpjJaExisteException,
  FabricanteDadosInvalidosException,
  TermoBuscaCurtoException,
} from "../../domain/errors/catalogo.errors";

/**
 * [RF008]: Controller REST para consulta de catálogo de medicamentos e gestão de fabricantes.
 */
@ApiTags("Catálogo de Medicamentos e Fabricantes")
@Controller("catalogo")
export class CatalogoController {
  constructor(
    private readonly buscarProdutosUseCase: BuscarProdutosCatalogoUseCase,
    private readonly listarFabricantesUseCase: ListarFabricantesUseCase,
    private readonly cadastrarFabricanteUseCase: CadastrarFabricanteUseCase,
  ) {}

  @Get("produtos/busca")
  @SkipTransaction()
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth("access-token")
  @ApiOperation({
    summary: "Busca textual de medicamentos no catálogo ativo (RF008)",
    description:
      "Pesquisa medicamentos por princípio ativo, nome comercial ou apresentação. Exige no mínimo 2 caracteres.",
  })
  @ApiOkResponse({
    description: "Lista de medicamentos retornada com sucesso.",
    type: [ProdutoCatalogoSwaggerResponse],
  })
  @ApiBadRequestResponse({
    description: "Termo de busca com menos de 2 caracteres.",
  })
  @ApiUnauthorizedResponse({
    description: "Token de autenticação ausente ou inválido.",
  })
  async buscarProdutos(
    @Query() query: BuscaProdutoCatalogoQueryDto,
  ): Promise<ProdutoCatalogoSwaggerResponse[]> {
    try {
      return await this.buscarProdutosUseCase.execute(query.termo);
    } catch (error) {
      if (error instanceof TermoBuscaCurtoException) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }

  @Get("fabricantes")
  @SkipTransaction()
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth("access-token")
  @ApiOperation({
    summary: "Lista todos os fabricantes/laboratórios farmacêuticos ativos (RF008)",
    description: "Retorna a listagem de fabricantes ativos ordenados alfabeticamente por nome fantasia.",
  })
  @ApiOkResponse({
    description: "Lista de fabricantes ativos retornada com sucesso.",
    type: [FabricanteSwaggerResponse],
  })
  @ApiUnauthorizedResponse({
    description: "Token de autenticação ausente ou inválido.",
  })
  async listarFabricantes(): Promise<FabricanteSwaggerResponse[]> {
    return this.listarFabricantesUseCase.execute();
  }

  @Post("fabricantes")
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth("access-token")
  @Roles(
    PerfilCodigo.FARMACEUTICO_RESPONSAVEL,
    PerfilCodigo.FARMACEUTICO_RESIDENTE,
    PerfilCodigo.ADMINISTRADOR,
    PerfilCodigo.GERENTE,
  )
  @ApiOperation({
    summary: "Cadastra um novo fabricante no catálogo (RF008)",
    description: "Permite o registro rápido de novo laboratório com razão social, nome fantasia e CNPJ opcional.",
  })
  @ApiCreatedResponse({
    description: "Fabricante cadastrado com sucesso.",
    type: FabricanteSwaggerResponse,
  })
  @ApiBadRequestResponse({
    description: "Dados cadastrais inválidos ou CNPJ com formato incorreto.",
  })
  @ApiConflictResponse({
    description: "CNPJ informado já cadastrado para outro fabricante.",
  })
  async cadastrarFabricante(
    @Body() dto: CriarFabricanteDto,
  ): Promise<FabricanteSwaggerResponse> {
    try {
      return await this.cadastrarFabricanteUseCase.execute(dto);
    } catch (error) {
      if (error instanceof FabricanteDadosInvalidosException) {
        throw new BadRequestException(error.message);
      }
      if (error instanceof FabricanteCnpjJaExisteException) {
        throw new ConflictException(error.message);
      }
      throw error;
    }
  }
}
