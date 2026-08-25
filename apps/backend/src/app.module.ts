import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import * as path from 'node:path';

@Module({
  imports: [
    // Carrega o .env da raiz do monorepo. O pnpm executa os scripts com CWD
    // em apps/backend, então o .env fica 2 níveis acima do CWD. Em container,
    // as variáveis vêm do compose (env_file/environment) e não são sobrescritas.
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: path.resolve(process.cwd(), '../../.env'),
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get<string>('DB_HOST', 'localhost'),
        port: parseInt(config.get<string>('DB_PORT', '5432'), 10),
        username: config.get<string>('POSTGRES_USER', 'farmaubs_admin'),
        password: config.get<string>('POSTGRES_PASSWORD', ''),
        database: config.get<string>('POSTGRES_DB', 'farmaubs'),
        schema: config.get<string>('DB_SCHEMA', 'public'),
        // Entities são registradas via TypeOrmModule.forFeature nos módulos
        // de domínio; o runtime não usa globs (isso é do data-source.ts).
        autoLoadEntities: true,
        // Migrations são a fonte de verdade do schema (ADR-016/ADR-022).
        synchronize: false,
      }),
    }),
  ],
})
export class AppModule {}
