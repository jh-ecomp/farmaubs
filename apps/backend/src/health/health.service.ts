import { Injectable } from '@nestjs/common';
import { DatabaseHealthPort } from './ports/database-health.port';

@Injectable()
export class HealthService {
  constructor(private readonly databaseHealth: DatabaseHealthPort) {}

  async check() {
    const databaseUp = await this.databaseHealth.isUp();

    return {
      status: databaseUp ? 'ok' : 'degraded',
      checks: {
        database: databaseUp ? 'up' : 'down',
      },
      timestamp: new Date().toISOString(),
    };
  }
}
