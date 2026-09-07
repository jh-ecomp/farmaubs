import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AUTH_REPOSITORY } from "./domain/ports/auth.repository.port";
import { SESSION_REPOSITORY } from "./domain/ports/session.repository.port";
import { LoginUseCase } from "./domain/use-cases/login.use-case";
import { AuthPgRepository } from "./infrastructure/adapters/auth-pg.repository";
import { SessionPgRepository } from "./infrastructure/adapters/session-pg.repository";
import { AuthController } from "./infrastructure/http/auth.controller";

@Module({
  imports: [ConfigModule],
  controllers: [AuthController],
  providers: [
    LoginUseCase,
    {
      provide: AUTH_REPOSITORY,
      useClass: AuthPgRepository,
    },
    {
      provide: SESSION_REPOSITORY,
      useClass: SessionPgRepository,
    },
  ],
  exports: [LoginUseCase, SESSION_REPOSITORY],
})
export class AuthModule {}
