import { Test, TestingModule } from "@nestjs/testing";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { INestApplication } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { UserController } from "./user.controller";
import { CadastrarUsuarioUseCase } from "../../application/use-cases/register-user.use-case";
import { ListUsersUseCase } from "../../application/use-cases/list-users.use-case";
import { RolesGuard } from "../../../../common/guards/roles.guard";
import { REPOSITORIO_PERFIL_PORT } from "../../domain/ports/profile.repository.port";

describe("Swagger Documentation - UserController", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserController],
      providers: [
        {
          provide: CadastrarUsuarioUseCase,
          useValue: { executar: jest.fn() },
        },
        {
          provide: ListUsersUseCase,
          useValue: { executar: jest.fn() },
        },
        {
          provide: REPOSITORIO_PERFIL_PORT,
          useValue: { buscarPorId: jest.fn() },
        },
        RolesGuard,
        Reflector,
      ],
    }).compile();

    app = module.createNestApplication();
    app.setGlobalPrefix("api/v1");
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it("deve gerar o documento Swagger contendo o endpoint POST /api/v1/usuarios e seus metadados", () => {
    const config = new DocumentBuilder()
      .setTitle("FarmaUBS API")
      .setDescription("API REST do FarmaUBS — Gestão de Insumos Farmacêuticos")
      .setVersion("1.0")
      .addTag("Usuários", "Operações de gestão e cadastro de usuários (RF001)")
      .build();

    const document = SwaggerModule.createDocument(app, config);

    expect(document.paths).toBeDefined();

    // No SwaggerModule com globalPrefix, a chave do endpoint é /api/v1/usuarios
    const pathItem = document.paths["/api/v1/usuarios"];
    expect(pathItem).toBeDefined();
    expect(pathItem.post).toBeDefined();

    const postOp = pathItem.post!;
    expect(postOp.tags).toContain("Usuários");
    expect(postOp.summary).toBe("Cadastra um novo usuário no sistema");
    expect(postOp.description).toContain("RF001");

    // Validação de códigos de resposta documentados
    expect(postOp.responses["201"]).toBeDefined();
    expect(postOp.responses["400"]).toBeDefined();
    expect(postOp.responses["401"]).toBeDefined();
    expect(postOp.responses["404"]).toBeDefined();
    expect(postOp.responses["409"]).toBeDefined();

    // Validação do schema do requestBody
    expect(postOp.requestBody).toBeDefined();

    // Validação do endpoint GET /api/v1/usuarios
    expect(pathItem.get).toBeDefined();
    const getOp = pathItem.get!;
    expect(getOp.tags).toContain("Usuários");
    expect(getOp.summary).toBe(
      "Lista usuários do sistema de forma paginada e filtrada",
    );
    expect(getOp.responses["200"]).toBeDefined();
    expect(getOp.responses["401"]).toBeDefined();
    expect(getOp.responses["403"]).toBeDefined();
  });
});
