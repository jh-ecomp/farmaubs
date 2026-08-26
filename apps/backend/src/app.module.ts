import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import * as path from 'node:path';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
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
        autoLoadEntities: true,
        synchronize: false,
      }),
    }),
    HealthModule,
  ],
})
export class AppModule {}
