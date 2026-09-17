import { Test, TestingModule } from "@nestjs/testing";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { INestApplication } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { UserController } from "./user.controller";
import { CadastrarUsuarioUseCase } from "../../application/use-cases/register-user.use-case";
import { ListUsersUseCase } from "../../application/use-cases/list-users.use-case";
import { EditUserUseCase } from "../../application/use-cases/edit-user.use-case";
import { UpdateAssociationsUseCase } from "../../application/use-cases/update-associations.use-case";
import { ToggleUserStatusUseCase } from "../../application/use-cases/toggle-user-status.use-case";
import { SetTemporaryPasswordUseCase } from "../../application/use-cases/set-temporary-password.use-case";
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
          provide: EditUserUseCase,
          useValue: { executar: jest.fn() },
        },
        {
          provide: UpdateAssociationsUseCase,
          useValue: { executar: jest.fn() },
        },
        {
          provide: ToggleUserStatusUseCase,
          useValue: { executar: jest.fn() },
        },
        {
          provide: SetTemporaryPasswordUseCase,
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

  it("deve gerar o documento Swagger contendo todos os endpoints de gestão de usuários", () => {
    const config = new DocumentBuilder()
      .setTitle("FarmaUBS API")
      .setDescription("API REST do FarmaUBS — Gestão de Insumos Farmacêuticos")
      .setVersion("1.0")
      .addTag(
        "Usuários",
        "Operações de gestão e cadastro de usuários (RF001, RF025)",
      )
      .build();

    const document = SwaggerModule.createDocument(app, config);

    expect(document.paths).toBeDefined();

    // POST e GET /api/v1/usuarios
    const basePathItem = document.paths["/api/v1/usuarios"];
    expect(basePathItem).toBeDefined();
    expect(basePathItem.post).toBeDefined();
    expect(basePathItem.get).toBeDefined();

    // PATCH /api/v1/usuarios/{id}
    const idPathItem = document.paths["/api/v1/usuarios/{id}"];
    expect(idPathItem).toBeDefined();
    expect(idPathItem.patch).toBeDefined();
    expect(idPathItem.patch!.summary).toContain("Edita dados cadastrais");
    expect(idPathItem.patch!.responses["200"]).toBeDefined();

    // PUT /api/v1/usuarios/{id}/associacoes
    const assocPathItem = document.paths["/api/v1/usuarios/{id}/associacoes"];
    expect(assocPathItem).toBeDefined();
    expect(assocPathItem.put).toBeDefined();
    expect(assocPathItem.put!.summary).toContain("Atualiza perfil de acesso");
    expect(assocPathItem.put!.responses["200"]).toBeDefined();

    // PATCH /api/v1/usuarios/{id}/status
    const statusPathItem = document.paths["/api/v1/usuarios/{id}/status"];
    expect(statusPathItem).toBeDefined();
    expect(statusPathItem.patch).toBeDefined();
    expect(statusPathItem.patch!.summary).toContain("Inativa ou reativa");
    expect(statusPathItem.patch!.responses["200"]).toBeDefined();

    // POST /api/v1/usuarios/{id}/senha-provisoria
    const senhaPathItem =
      document.paths["/api/v1/usuarios/{id}/senha-provisoria"];
    expect(senhaPathItem).toBeDefined();
    expect(senhaPathItem.post).toBeDefined();
    expect(senhaPathItem.post!.summary).toContain(
      "Define uma senha provisória",
    );
    expect(senhaPathItem.post!.responses["204"]).toBeDefined();
    expect(senhaPathItem.post!.responses["400"]).toBeDefined();
  });
});
