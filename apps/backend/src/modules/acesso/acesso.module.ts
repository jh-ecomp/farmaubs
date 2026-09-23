import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { UserController } from "./api/controllers/user.controller";
import { AcessoController } from "./api/controllers/acesso.controller";
import { CadastrarUsuarioUseCase } from "./application/use-cases/register-user.use-case";
import { ListUsersUseCase } from "./application/use-cases/list-users.use-case";
import { EditUserUseCase } from "./application/use-cases/edit-user.use-case";
import { UpdateAssociationsUseCase } from "./application/use-cases/update-associations.use-case";
import { ToggleUserStatusUseCase } from "./application/use-cases/toggle-user-status.use-case";
import { SetTemporaryPasswordUseCase } from "./application/use-cases/set-temporary-password.use-case";
import { LoginUseCase } from "./application/use-cases/login.use-case";
import { RenewSessionUseCase } from "./application/use-cases/renew-session.use-case";
import { LogoutUseCase } from "./application/use-cases/logout.use-case";
import { RolesGuard } from "../../common/guards/roles.guard";

import { TypeOrmUserRepository } from "./infrastructure/adapters/typeorm-user.repository";
import { TypeOrmProfileRepository } from "./infrastructure/adapters/typeorm-profile.repository";
import { TypeOrmHealthUnitRepository } from "./infrastructure/adapters/typeorm-health-unit.repository";
import { BcryptPasswordHasherAdapter } from "./infrastructure/adapters/bcrypt-password-hasher.adapter";
import { ConsoleEmailServiceAdapter } from "./infrastructure/adapters/console-email-service.adapter";
import { AcessoPgRepository } from "./infrastructure/adapters/acesso-pg.repository";
import { SessionPgRepository } from "./infrastructure/adapters/session-pg.repository";
import { REPOSITORIO_USUARIO_PORT } from "./domain/ports/user.repository.port";
import { REPOSITORIO_PERFIL_PORT } from "./domain/ports/profile.repository.port";
import { REPOSITORIO_UNIDADE_SAUDE_PORT } from "./domain/ports/health-unit.repository.port";
import { GERADOR_HASH_SENHA_PORT } from "./domain/ports/password-hasher.port";
import { SERVICO_EMAIL_PORT } from "./domain/ports/email-service.port";
import { ACESSO_REPOSITORY } from "./domain/ports/acesso.repository.port";
import { SESSION_REPOSITORY } from "./domain/ports/session.repository.port";
import { AUDIT_REPOSITORY_PORT } from "./domain/ports/audit.repository.port";
import { TypeOrmAuditRepository } from "./infrastructure/adapters/typeorm-audit.repository";

@Module({
  imports: [ConfigModule],
  controllers: [AcessoController, UserController],
  providers: [
    LoginUseCase,
    RenewSessionUseCase,
    LogoutUseCase,
    ListUsersUseCase,
    EditUserUseCase,
    UpdateAssociationsUseCase,
    ToggleUserStatusUseCase,
    SetTemporaryPasswordUseCase,
    RolesGuard,
    {
      provide: ACESSO_REPOSITORY,
      useClass: AcessoPgRepository,
    },
    {
      provide: SESSION_REPOSITORY,
      useClass: SessionPgRepository,
    },
    TypeOrmUserRepository,
    TypeOrmProfileRepository,
    TypeOrmHealthUnitRepository,
    TypeOrmAuditRepository,
    BcryptPasswordHasherAdapter,
    ConsoleEmailServiceAdapter,
    {
      provide: REPOSITORIO_USUARIO_PORT,
      useExisting: TypeOrmUserRepository,
    },
    {
      provide: AUDIT_REPOSITORY_PORT,
      useExisting: TypeOrmAuditRepository,
    },
    {
      provide: REPOSITORIO_PERFIL_PORT,
      useExisting: TypeOrmProfileRepository,
    },
    {
      provide: REPOSITORIO_UNIDADE_SAUDE_PORT,
      useExisting: TypeOrmHealthUnitRepository,
    },
    {
      provide: GERADOR_HASH_SENHA_PORT,
      useExisting: BcryptPasswordHasherAdapter,
    },
    {
      provide: SERVICO_EMAIL_PORT,
      useExisting: ConsoleEmailServiceAdapter,
    },
    {
      provide: CadastrarUsuarioUseCase,
      useFactory: (
        userRepo: TypeOrmUserRepository,
        profileRepo: TypeOrmProfileRepository,
        passwordHasher: BcryptPasswordHasherAdapter,
        healthUnitRepo: TypeOrmHealthUnitRepository,
        emailService: ConsoleEmailServiceAdapter,
      ) => {
        return new CadastrarUsuarioUseCase(
          userRepo,
          profileRepo,
          passwordHasher,
          healthUnitRepo,
          emailService,
        );
      },
      inject: [
        TypeOrmUserRepository,
        TypeOrmProfileRepository,
        BcryptPasswordHasherAdapter,
        TypeOrmHealthUnitRepository,
        ConsoleEmailServiceAdapter,
      ],
    },
  ],
  exports: [
    LoginUseCase,
    RenewSessionUseCase,
    LogoutUseCase,
    ListUsersUseCase,
    EditUserUseCase,
    UpdateAssociationsUseCase,
    ToggleUserStatusUseCase,
    SetTemporaryPasswordUseCase,
    RolesGuard,
    SESSION_REPOSITORY,
    CadastrarUsuarioUseCase,
    REPOSITORIO_USUARIO_PORT,
    REPOSITORIO_PERFIL_PORT,
    REPOSITORIO_UNIDADE_SAUDE_PORT,
    GERADOR_HASH_SENHA_PORT,
    SERVICO_EMAIL_PORT,
    AUDIT_REPOSITORY_PORT,
    TypeOrmAuditRepository,
  ],
})
export class AcessoModule {}
