import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ACESSO_REPOSITORY } from "./domain/ports/acesso.repository.port";
import { SESSION_REPOSITORY } from "./domain/ports/session.repository.port";
import { LoginUseCase } from "./domain/use-cases/login.use-case";
import { AcessoPgRepository } from "./infrastructure/adapters/acesso-pg.repository";
import { SessionPgRepository } from "./infrastructure/adapters/session-pg.repository";
import { AcessoController } from "./infrastructure/http/acesso.controller";

@Module({
  imports: [ConfigModule],
  controllers: [AcessoController],
  providers: [
    LoginUseCase,
    {
      provide: ACESSO_REPOSITORY,
      useClass: AcessoPgRepository,
    },
    {
      provide: SESSION_REPOSITORY,
      useClass: SessionPgRepository,
    },
  ],
  exports: [LoginUseCase, SESSION_REPOSITORY],
})
export class AcessoModule {}
