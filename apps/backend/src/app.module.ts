import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
import { TypeOrmModule } from "@nestjs/typeorm";
import * as path from "node:path";
import { CommonModule } from "./common/common.module";
import { HealthModule } from "./health/health.module";
import { AcessoModule } from "./modules/acesso/acesso.module";
import { SessionAuthGuard } from "./common/guards/session-auth.guard";
import { TenantInterceptor } from "./common/tenant/tenant.interceptor";
import { TransactionInterceptor } from "./common/transaction/transaction.interceptor";
import { SessionHeaderInterceptor } from "./common/interceptors/session-header.interceptor";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: path.resolve(process.cwd(), "../../.env"),
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: "postgres",
        host: config.get<string>("DB_HOST", "localhost"),
        port: parseInt(config.get<string>("DB_PORT", "5432"), 10),
        username: config.get<string>("DB_USER", "farmaubs_app"),
        password: config.get<string>("DB_PASSWORD", ""),
        database: config.get<string>("POSTGRES_DB", "farmaubs"),
        schema: config.get<string>("DB_SCHEMA", "public"),
        autoLoadEntities: true,
        synchronize: false,
      }),
    }),
    CommonModule,
    HealthModule,
    AcessoModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: SessionAuthGuard },
    { provide: APP_INTERCEPTOR, useClass: TenantInterceptor },
    { provide: APP_INTERCEPTOR, useClass: TransactionInterceptor },
    { provide: APP_INTERCEPTOR, useClass: SessionHeaderInterceptor },
  ],
})
export class AppModule {}
