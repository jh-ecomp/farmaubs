import { Test } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { lastValueFrom, of } from 'rxjs';
import { TransactionInterceptor } from './transaction.interceptor';
import { TenantContextService } from '../tenant/tenant-context.service';
import { TransactionContext } from './transaction-context.service';
import { SKIP_TRANSACTION_KEY } from './skip-transaction.decorator';

const GUC_TENANT = 'app.municipio_id';

describe('TransactionInterceptor', () => {
  let interceptor: TransactionInterceptor;
  let queryRunner: {
    connect: jest.Mock;
    startTransaction: jest.Mock;
    commitTransaction: jest.Mock;
    rollbackTransaction: jest.Mock;
    release: jest.Mock;
    query: jest.Mock;
  };
  let dataSource: { createQueryRunner: jest.Mock };
  let reflector: { getAllAndOverride: jest.Mock };
  let tenantContext: { getMunicipioId: jest.Mock };
  let transactionContext: { run: jest.Mock };

  const next = { handle: () => of({ ok: true }) };

  const createContext = () =>
    ({
      getHandler: () => () => {},
      getClass: () => class {},
    }) as any;

  beforeEach(async () => {
    queryRunner = {
      connect: jest.fn().mockResolvedValue(undefined),
      startTransaction: jest.fn().mockResolvedValue(undefined),
      commitTransaction: jest.fn().mockResolvedValue(undefined),
      rollbackTransaction: jest.fn().mockResolvedValue(undefined),
      release: jest.fn().mockResolvedValue(undefined),
      query: jest.fn().mockResolvedValue(undefined),
    };

    dataSource = { createQueryRunner: jest.fn().mockReturnValue(queryRunner) };
    reflector = { getAllAndOverride: jest.fn().mockReturnValue(false) };
    tenantContext = { getMunicipioId: jest.fn().mockReturnValue(null) };
    transactionContext = {
      run: jest.fn().mockImplementation((_qr, fn) => fn()),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        TransactionInterceptor,
        { provide: DataSource, useValue: dataSource },
        { provide: Reflector, useValue: reflector },
        { provide: TenantContextService, useValue: tenantContext },
        { provide: TransactionContext, useValue: transactionContext },
      ],
    }).compile();

    interceptor = moduleRef.get(TransactionInterceptor);
  });

  it('aplica o GUC com o municipio_id do contexto e faz commit', async () => {
    tenantContext.getMunicipioId.mockReturnValue('municipio-1');

    const result = await lastValueFrom(
      interceptor.intercept(createContext(), next),
    );

    expect(queryRunner.query).toHaveBeenCalledWith(
      'SELECT set_config($1, $2, true)',
      [GUC_TENANT, 'municipio-1'],
    );
    expect(queryRunner.commitTransaction).toHaveBeenCalled();
    expect(queryRunner.release).toHaveBeenCalled();
    expect(result).toEqual({ ok: true });
  });

  it('aplica GUC vazio (fail-closed) quando não há escopo de tenant', async () => {
    tenantContext.getMunicipioId.mockReturnValue(null);

    await lastValueFrom(interceptor.intercept(createContext(), next));

    expect(queryRunner.query).toHaveBeenCalledWith(
      'SELECT set_config($1, $2, true)',
      [GUC_TENANT, ''],
    );
    expect(queryRunner.commitTransaction).toHaveBeenCalled();
  });

  it('entrega o queryRunner transacional ao TransactionContext', async () => {
    tenantContext.getMunicipioId.mockReturnValue('municipio-1');

    await lastValueFrom(interceptor.intercept(createContext(), next));

    expect(transactionContext.run).toHaveBeenCalledWith(
      queryRunner,
      expect.any(Function),
    );
  });

  it('faz rollback e relança a exceção quando o handler falha', async () => {
    tenantContext.getMunicipioId.mockReturnValue('municipio-1');
    transactionContext.run.mockImplementation(() => {
      throw new Error('falha no caso de uso');
    });

    await expect(
      lastValueFrom(interceptor.intercept(createContext(), next)),
    ).rejects.toThrow('falha no caso de uso');

    expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
    expect(queryRunner.commitTransaction).not.toHaveBeenCalled();
    expect(queryRunner.release).toHaveBeenCalled();
  });

  it('pula a transação quando @SkipTransaction está presente', async () => {
    reflector.getAllAndOverride.mockReturnValue(true);

    const result = await lastValueFrom(
      interceptor.intercept(createContext(), next),
    );

    expect(reflector.getAllAndOverride).toHaveBeenCalledWith(
      SKIP_TRANSACTION_KEY,
      [expect.any(Function), expect.any(Function)],
    );
    expect(dataSource.createQueryRunner).not.toHaveBeenCalled();
    expect(result).toEqual({ ok: true });
  });
});
