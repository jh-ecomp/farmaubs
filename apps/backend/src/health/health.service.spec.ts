import { HealthService } from './health.service';
import { DatabaseHealthPort } from './ports/database-health.port';

describe('HealthService (unit)', () => {
  let service: HealthService;
  let databaseHealth: jest.Mocked<DatabaseHealthPort>;

  beforeEach(() => {
    // Mock manual da porta de infraestrutura (camada A — ADR-030)
    databaseHealth = { isUp: jest.fn() } as jest.Mocked<DatabaseHealthPort>;
    service = new HealthService(databaseHealth);
  });

  it('retorna status ok e database up quando o banco responde', async () => {
    databaseHealth.isUp.mockResolvedValue(true);

    const result = await service.check();

    expect(result.status).toBe('ok');
    expect(result.checks.database).toBe('up');
    expect(databaseHealth.isUp).toHaveBeenCalledTimes(1);
  });

  it('retorna status degraded e database down quando o banco falha', async () => {
    databaseHealth.isUp.mockResolvedValue(false);

    const result = await service.check();

    expect(result.status).toBe('degraded');
    expect(result.checks.database).toBe('down');
    expect(databaseHealth.isUp).toHaveBeenCalledTimes(1);
  });

  it('propaga erro do adaptador de banco (ex.: timeout inesperado)', async () => {
    databaseHealth.isUp.mockRejectedValue(new Error('pool exhausted'));

    await expect(service.check()).rejects.toThrow('pool exhausted');
  });

  it('sempre emite um timestamp válido no resultado', async () => {
    databaseHealth.isUp.mockResolvedValue(true);

    const result = await service.check();

    expect(result.timestamp).toBeDefined();
    expect(new Date(result.timestamp).getTime()).not.toBeNaN();
  });
});
