import { Injectable } from "@nestjs/common";
import type {
  CriarFabricanteRequest,
  FabricanteResponseDto,
  ProdutoCatalogoResponseDto,
} from "@farmaubs/shared";
import { TransactionContext } from "../../../../common/transaction/transaction-context.service";
import type { CatalogoRepositoryPort } from "../../domain/ports/catalogo.repository.port";
import { ProdutoEntity } from "../persistence/entities/produto.entity";
import { FabricanteEntity } from "../persistence/entities/fabricante.entity";

/**
 * [RF008]: Adaptador TypeORM para consultas e operações do catálogo de medicamentos e fabricantes.
 */
@Injectable()
export class TypeOrmCatalogoRepository implements CatalogoRepositoryPort {
  constructor(private readonly transactionContext: TransactionContext) {}

  /**
   * Busca medicamentos ativos no catálogo por termo parcial (princípio ativo, nome comercial ou apresentação).
   * @param termo - Texto de busca.
   * @returns Lista de até 50 produtos correspondentes.
   */
  async buscarProdutosPorTermo(
    termo: string,
  ): Promise<ProdutoCatalogoResponseDto[]> {
    const manager = this.transactionContext.getManager();
    const termoSql = `%${termo}%`;

    const produtos = await manager
      .createQueryBuilder(ProdutoEntity, "p")
      .where("p.ativo = true")
      .andWhere(
        "(p.principio_ativo ILIKE :termo OR p.nome_comercial ILIKE :termo OR p.apresentacao ILIKE :termo OR p.codigo_catmat ILIKE :termo)",
        { termo: termoSql },
      )
      .orderBy("p.principio_ativo", "ASC")
      .limit(50)
      .getMany();

    return produtos.map((p) => ({
      id: p.id,
      codigoCatmat: p.codigo_catmat,
      codigoAtc: p.codigo_atc,
      nomeComercial: p.nome_comercial,
      principioAtivo: p.principio_ativo,
      dosagem: p.dosagem,
      formaFarmaceutica: p.forma_farmaceutica,
      apresentacao: p.apresentacao,
      unidadeMedida: p.unidade_medida,
      categoria: p.categoria,
      componente: p.componente,
      antimicrobiano: p.antimicrobiano,
      controlado: p.controlado,
      ativo: p.ativo,
    }));
  }

  /**
   * Obtém um produto específico pelo ID.
   * @param id - Identificador UUID do produto.
   */
  async buscarProdutoPorId(
    id: string,
  ): Promise<ProdutoCatalogoResponseDto | null> {
    const manager = this.transactionContext.getManager();
    const produto = await manager.findOne(ProdutoEntity, {
      where: { id, ativo: true },
    });

    if (!produto) return null;

    return {
      id: produto.id,
      codigoCatmat: produto.codigo_catmat,
      codigoAtc: produto.codigo_atc,
      nomeComercial: produto.nome_comercial,
      principioAtivo: produto.principio_ativo,
      dosagem: produto.dosagem,
      formaFarmaceutica: produto.forma_farmaceutica,
      apresentacao: produto.apresentacao,
      unidadeMedida: produto.unidade_medida,
      categoria: produto.categoria,
      componente: produto.componente,
      antimicrobiano: produto.antimicrobiano,
      controlado: produto.controlado,
      ativo: produto.ativo,
    };
  }

  /**
   * Lista todos os fabricantes ativos ordenados pelo nome fantasia.
   */
  async listarFabricantesAtivos(): Promise<FabricanteResponseDto[]> {
    const manager = this.transactionContext.getManager();
    const fabricantes = await manager.find(FabricanteEntity, {
      where: { ativo: true },
      order: { nome_fantasia: "ASC" },
    });

    return fabricantes.map((f) => ({
      id: f.id,
      razaoSocial: f.razao_social,
      nomeFantasia: f.nome_fantasia,
      cnpj: f.cnpj,
      ativo: f.ativo,
    }));
  }

  /**
   * Localiza fabricante ativo ou inativo por CNPJ.
   * @param cnpj - CNPJ de 14 dígitos.
   */
  async buscarFabricantePorCnpj(
    cnpj: string,
  ): Promise<FabricanteResponseDto | null> {
    const manager = this.transactionContext.getManager();
    const fabricante = await manager.findOne(FabricanteEntity, {
      where: { cnpj },
    });

    if (!fabricante) return null;

    return {
      id: fabricante.id,
      razaoSocial: fabricante.razao_social,
      nomeFantasia: fabricante.nome_fantasia,
      cnpj: fabricante.cnpj,
      ativo: fabricante.ativo,
    };
  }

  /**
   * Persiste um novo fabricante no catálogo.
   * @param dados - Dados cadastrais validados.
   */
  async cadastrarFabricante(
    dados: CriarFabricanteRequest,
  ): Promise<FabricanteResponseDto> {
    const manager = this.transactionContext.getManager();
    const novo = manager.create(FabricanteEntity, {
      razao_social: dados.razaoSocial,
      nome_fantasia: dados.nomeFantasia,
      cnpj: dados.cnpj ?? null,
      ativo: true,
    });

    const salvo = await manager.save(FabricanteEntity, novo);

    return {
      id: salvo.id,
      razaoSocial: salvo.razao_social,
      nomeFantasia: salvo.nome_fantasia,
      cnpj: salvo.cnpj,
      ativo: salvo.ativo,
    };
  }
}
