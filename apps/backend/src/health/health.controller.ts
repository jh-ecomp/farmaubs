import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { SkipTransaction } from '../common/transaction/skip-transaction.decorator';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { HealthService } from './health.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @SkipTransaction()
  @ApiOperation({
    summary: 'Verifica a saúde do serviço e da conexão com o banco',
  })
  @ApiOkResponse({
    description: 'Serviço operacional',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['ok', 'degraded'], example: 'ok' },
        checks: {
          type: 'object',
          properties: {
            database: { type: 'string', enum: ['up', 'down'], example: 'up' },
          },
        },
        timestamp: { type: 'string', example: '2026-08-26T01:30:00.000Z' },
      },
    },
  })
  async check() {
    const result = await this.healthService.check();
    if (result.status === 'degraded') {
      throw new ServiceUnavailableException(result); // 503 quando degradado
    }
    return result;
  }
}
