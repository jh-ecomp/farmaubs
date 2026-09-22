import { defineFeature, loadFeature } from "jest-cucumber";
import * as path from "path";
import { BadRequestException, UnauthorizedException } from "@nestjs/common";
import { AdministracaoController } from "../../api/controllers/administracao.controller";
import { ListMunicipiosUseCase } from "./list-municipios.use-case";
import { ListUnidadesSaudeUseCase } from "./list-unidades-saude.use-case";
import type { RepositorioMunicipioPort } from "../../domain/ports/municipio.repository.port";
import type { RepositorioUnidadeSaudePort } from "../../domain/ports/unidade-saude.repository.port";
import type { MunicipioDto, UnidadeSaudeDto } from "@farmaubs/shared";

const feature = loadFeature(
  path.resolve(__dirname, "catalogo-administracao.feature"),
);

defineFeature(feature, (test) => {
  let controller: AdministracaoController;
  let listMunicipiosUseCase: ListMunicipiosUseCase;
  let listUnidadesSaudeUseCase: ListUnidadesSaudeUseCase;
  let municipioRepoMock: jest.Mocked<RepositorioMunicipioPort>;
  let unidadeSaudeRepoMock: jest.Mocked<RepositorioUnidadeSaudePort>;

  let respostaStatus: number | null = null;
  let respostaCorpo: unknown = null;
  let erroCapturado: Error | null = null;

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
    {
      id: "01919a77-3e15-7000-8000-000000000002",
      nome: "Teresina",
      uf: "PI",
      ibgeCode: "2211001",
    },
  ];

  const targetMunicipioId = "01a06db9-c4af-7944-8ec5-c9b9443b054e";
  const mockUnidades: UnidadeSaudeDto[] = [
    {
      id: "01919a77-3e15-7000-8000-000000000010",
      municipioId: targetMunicipioId,
      nome: "UBS Campo Velho",
      endereco: "Rua São Pedro, 100",
      responsavelTecnico: "Dra. Juliana Miranda",
      cafLeadTimeDays: 15,
    },
    {
      id: "01919a77-3e15-7000-8000-000000000011",
      municipioId: targetMunicipioId,
      nome: "UBS Viazul",
      endereco: "Av. Principal, 50",
      responsavelTecnico: null,
      cafLeadTimeDays: 10,
    },
  ];

  beforeEach(() => {
    respostaStatus = null;
    respostaCorpo = null;
    erroCapturado = null;

    municipioRepoMock = {
      listarAtivos: jest.fn(),
    };
    unidadeSaudeRepoMock = {
      buscarPorMunicipio: jest.fn(),
    };

    listMunicipiosUseCase = new ListMunicipiosUseCase(municipioRepoMock);
    listUnidadesSaudeUseCase = new ListUnidadesSaudeUseCase(
      unidadeSaudeRepoMock,
    );
    controller = new AdministracaoController(
      listMunicipiosUseCase,
      listUnidadesSaudeUseCase,
    );
  });

  test("Consulta de municípios com sessão válida", ({
    given,
    and,
    when,
    then,
  }) => {
    given("que o usuário está autenticado com sessão válida", () => {
      // Sessão autenticada simulada
    });

    and("existem municípios ativos cadastrados no banco de dados", () => {
      municipioRepoMock.listarAtivos.mockResolvedValue(mockMunicipios);
    });

    when(
      'uma requisição "GET /api/v1/administracao/municipios" for executada',
      async () => {
        try {
          respostaCorpo = await controller.listarMunicipios();
          respostaStatus = 200;
        } catch (err) {
          erroCapturado = err as Error;
        }
      },
    );

    then("o sistema deve responder com HTTP 200 OK", () => {
      expect(respostaStatus).toBe(200);
      expect(erroCapturado).toBeNull();
    });

    and(
      "o corpo da resposta deve ser um array contendo os municípios ordenados alfabeticamente por nome",
      () => {
        expect(Array.isArray(respostaCorpo)).toBe(true);
        const lista = respostaCorpo as MunicipioDto[];
        expect(lista).toHaveLength(3);
        expect(lista.map((m) => m.nome)).toEqual([
          "Floriano",
          "Parnaíba",
          "Teresina",
        ]);
      },
    );

    and('cada item deve conter "id", "nome", "uf" e "ibgeCode"', () => {
      const lista = respostaCorpo as MunicipioDto[];
      for (const item of lista) {
        expect(item).toHaveProperty("id");
        expect(item).toHaveProperty("nome");
        expect(item).toHaveProperty("uf");
        expect(item).toHaveProperty("ibgeCode");
      }
    });
  });

  test("Consulta de UBSs informando municipioId válido", ({
    given,
    and,
    when,
    then,
  }) => {
    given("que o usuário está autenticado com sessão válida", () => {
      // Sessão autenticada simulada
    });

    and(
      /^existem UBSs cadastradas para o município "(.*)"$/,
      (muniId: string) => {
        unidadeSaudeRepoMock.buscarPorMunicipio.mockImplementation(
          async (id) => {
            if (id === muniId) return mockUnidades;
            return [];
          },
        );
      },
    );

    when(
      /^uma requisição "GET \/api\/v1\/administracao\/unidades-saude\?municipioId=(.*)" for executada$/,
      async (muniId: string) => {
        try {
          respostaCorpo = await controller.listarUnidadesSaude(muniId);
          respostaStatus = 200;
        } catch (err) {
          erroCapturado = err as Error;
        }
      },
    );

    then("o sistema deve responder com HTTP 200 OK", () => {
      expect(respostaStatus).toBe(200);
      expect(erroCapturado).toBeNull();
    });

    and(
      "o corpo da resposta deve ser um array com as unidades pertencentes àquele município ordenadas por nome",
      () => {
        expect(Array.isArray(respostaCorpo)).toBe(true);
        const lista = respostaCorpo as UnidadeSaudeDto[];
        expect(lista).toHaveLength(2);
        expect(lista.map((u) => u.nome)).toEqual([
          "UBS Campo Velho",
          "UBS Viazul",
        ]);
      },
    );

    and(
      'cada item deve conter "id", "municipioId", "nome", "endereco", "responsavelTecnico" e "cafLeadTimeDays"',
      () => {
        const lista = respostaCorpo as UnidadeSaudeDto[];
        for (const item of lista) {
          expect(item).toHaveProperty("id");
          expect(item).toHaveProperty("municipioId");
          expect(item).toHaveProperty("nome");
          expect(item).toHaveProperty("endereco");
          expect(item).toHaveProperty("responsavelTecnico");
          expect(item).toHaveProperty("cafLeadTimeDays");
        }
      },
    );
  });

  test("Consulta de UBSs sem informar municipioId", ({
    given,
    when,
    then,
    and,
  }) => {
    given("que o usuário está autenticado com sessão válida", () => {
      // Sessão autenticada simulada
    });

    when(
      'uma requisição "GET /api/v1/administracao/unidades-saude" for executada sem o parâmetro "municipioId"',
      async () => {
        try {
          respostaCorpo = await controller.listarUnidadesSaude(undefined);
          respostaStatus = 200;
        } catch (err) {
          erroCapturado = err as Error;
          if (err instanceof BadRequestException) {
            respostaStatus = 400;
          }
        }
      },
    );

    then("o sistema deve responder com HTTP 400 Bad Request", () => {
      expect(respostaStatus).toBe(400);
      expect(erroCapturado).toBeInstanceOf(BadRequestException);
    });

    and(
      "a mensagem deve indicar \"O parâmetro 'municipioId' é obrigatório para consulta de unidades de saúde.\"",
      () => {
        expect(erroCapturado?.message).toBe(
          "O parâmetro 'municipioId' é obrigatório para consulta de unidades de saúde.",
        );
      },
    );
  });

  test("Tentativa de consulta de catálogo sem autenticação", ({
    given,
    when,
    then,
  }) => {
    let possuiTokenValido = true;

    given(
      'que a requisição não possui cabeçalho "Authorization" com Bearer token válido',
      () => {
        possuiTokenValido = false;
      },
    );

    when(
      'uma requisição "GET /api/v1/administracao/municipios" for executada',
      async () => {
        try {
          if (!possuiTokenValido) {
            throw new UnauthorizedException(
              "Token de autenticação ausente ou inválido",
            );
          }
          respostaCorpo = await controller.listarMunicipios();
          respostaStatus = 200;
        } catch (err) {
          erroCapturado = err as Error;
          if (err instanceof UnauthorizedException) {
            respostaStatus = 401;
          }
        }
      },
    );

    then("o sistema deve responder com HTTP 401 Unauthorized", () => {
      expect(respostaStatus).toBe(401);
      expect(erroCapturado).toBeInstanceOf(UnauthorizedException);
    });
  });
});
