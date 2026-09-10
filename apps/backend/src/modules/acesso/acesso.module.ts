import { Module } from '@nestjs/common';
import { UserController } from './api/controllers/user.controller';
import { CadastrarUsuarioUseCase } from './application/use-cases/register-user.use-case';
import { TypeOrmUserRepository } from './infrastructure/adapters/typeorm-user.repository';
import { TypeOrmProfileRepository } from './infrastructure/adapters/typeorm-profile.repository';
import { TypeOrmHealthUnitRepository } from './infrastructure/adapters/typeorm-health-unit.repository';
import { BcryptPasswordHasherAdapter } from './infrastructure/adapters/bcrypt-password-hasher.adapter';
import { ConsoleEmailServiceAdapter } from './infrastructure/adapters/console-email-service.adapter';
import { REPOSITORIO_USUARIO_PORT } from './domain/ports/user.repository.port';
import { REPOSITORIO_PERFIL_PORT } from './domain/ports/profile.repository.port';
import { REPOSITORIO_UNIDADE_SAUDE_PORT } from './domain/ports/health-unit.repository.port';
import { GERADOR_HASH_SENHA_PORT } from './domain/ports/password-hasher.port';
import { SERVICO_EMAIL_PORT } from './domain/ports/email-service.port';

@Module({
  controllers: [UserController],
  providers: [
    TypeOrmUserRepository,
    TypeOrmProfileRepository,
    TypeOrmHealthUnitRepository,
    BcryptPasswordHasherAdapter,
    ConsoleEmailServiceAdapter,
    {
      provide: REPOSITORIO_USUARIO_PORT,
      useExisting: TypeOrmUserRepository,
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
    CadastrarUsuarioUseCase,
    REPOSITORIO_USUARIO_PORT,
    REPOSITORIO_PERFIL_PORT,
    REPOSITORIO_UNIDADE_SAUDE_PORT,
    GERADOR_HASH_SENHA_PORT,
    SERVICO_EMAIL_PORT,
  ],
})
export class AcessoModule {}
