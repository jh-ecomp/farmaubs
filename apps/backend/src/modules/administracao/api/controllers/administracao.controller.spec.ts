import { Test, TestingModule } from "@nestjs/testing";
import { BadRequestException } from "@nestjs/common";
import { AdministracaoController } from "./administracao.controller";
import { ListMunicipiosUseCase } from "../../application/use-cases/list-municipios.use-case";
import { ListUnidadesSaudeUseCase } from "../../application/use-cases/list-unidades-saude.use-case";
import type { MunicipioDto, UnidadeSaudeDto } from "@farmaubs/shared";

describe("AdministracaoController", () => {
  let controller: AdministracaoController;
  let listMunicipiosUseCaseMock: jest.Mocked<ListMunicipiosUseCase>;
  let listUnidadesSaudeUseCaseMock: jest.Mocked<ListUnidadesSaudeUseCase>;

  const mockMunicipios: MunicipioDto[] = [
    {
      id: "01a06db9-c4af-7944-8ec5-c9b9443b054e",
      nome: "Floriano",
      uf: "PI",
      ibgeCode: "2203907",
    },
    {
      id: "01919a77-3e15-7000-8000-000000000001",
      nome: "Parnaíba",
      uf: "PI",
      ibgeCode: "2207700",
    },
  ];

  const mockUnidades: UnidadeSaudeDto[] = [
    {
      id: "ubs-1",
      municipioId: "01a06db9-c4af-7944-8ec5-c9b9443b054e",
      nome: "UBS Centro de Saúde Dr. Pedro",
      endereco: "Av. Bucar Neto, 100",
      responsavelTecnico: "Dra. Maria Santos",
      cafLeadTimeDays: 10,
    },
  ];

  beforeEach(async () => {
    listMunicipiosUseCaseMock = {
      executar: jest.fn().mockResolvedValue(mockMunicipios),
    } as unknown as jest.Mocked<ListMunicipiosUseCase>;

    listUnidadesSaudeUseCaseMock = {
      executar: jest.fn().mockResolvedValue(mockUnidades),
    } as unknown as jest.Mocked<ListUnidadesSaudeUseCase>;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdministracaoController],
      providers: [
        {
          provide: ListMunicipiosUseCase,
          useValue: listMunicipiosUseCaseMock,
        },
        {
          provide: ListUnidadesSaudeUseCase,
          useValue: listUnidadesSaudeUseCaseMock,
        },
      ],
    }).compile();

    controller = module.get<AdministracaoController>(AdministracaoController);
  });

  describe("GET /administracao/municipios", () => {
    it("deve retornar lista de municípios ativos com sucesso", async () => {
      const resultado = await controller.listarMunicipios();

      expect(listMunicipiosUseCaseMock.executar).toHaveBeenCalledTimes(1);
      expect(resultado).toEqual(mockMunicipios);
    });
  });

  describe("GET /administracao/unidades-saude", () => {
    it("deve retornar lista de UBSs para o município informado", async () => {
      const municipioId = "01a06db9-c4af-7944-8ec5-c9b9443b054e";
      const resultado = await controller.listarUnidadesSaude(municipioId);

      expect(listUnidadesSaudeUseCaseMock.executar).toHaveBeenCalledWith(
        municipioId,
      );
      expect(resultado).toEqual(mockUnidades);
    });

    it("deve lançar BadRequestException se o use case rejeitar por falta de municipioId", async () => {
      listUnidadesSaudeUseCaseMock.executar.mockRejectedValue(
        new BadRequestException(
          "O parâmetro 'municipioId' é obrigatório para consulta de unidades de saúde.",
        ),
      );

      await expect(controller.listarUnidadesSaude(undefined)).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
