import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { DatabaseHealthPort } from './ports/database-health.port';
import { TypeOrmDatabaseHealthAdapter } from './adapters/typeorm-database-health.adapter';

@Module({
  controllers: [HealthController],
  providers: [
    HealthService,
    {
      provide: DatabaseHealthPort,
      useClass: TypeOrmDatabaseHealthAdapter,
    },
  ],
})
export class HealthModule {}
