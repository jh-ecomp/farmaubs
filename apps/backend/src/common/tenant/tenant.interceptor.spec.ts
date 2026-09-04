import { Test } from '@nestjs/testing';
import { lastValueFrom, of } from 'rxjs';
import { TenantInterceptor } from './tenant.interceptor';
import { TenantContextService } from './tenant-context.service';

describe('TenantInterceptor', () => {
  let interceptor: TenantInterceptor;
  let tenantContext: { run: jest.Mock };

  const next = { handle: () => of('ok') };

  const createHttpContext = (session?: unknown) =>
    ({
      getType: () => 'http',
      switchToHttp: () => ({ getRequest: () => ({ session }) }),
    }) as any;

  beforeEach(async () => {
    tenantContext = { run: jest.fn().mockImplementation((_scope, fn) => fn()) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        TenantInterceptor,
        { provide: TenantContextService, useValue: tenantContext },
      ],
    }).compile();

    interceptor = moduleRef.get(TenantInterceptor);
  });

  it('propaga o municipio_id da sessão para o contexto de tenant', async () => {
    await lastValueFrom(
      interceptor.intercept(
        createHttpContext({ municipioId: 'municipio-1' }),
        next,
      ),
    );

    expect(tenantContext.run).toHaveBeenCalledWith(
      { municipioId: 'municipio-1' },
      expect.any(Function),
    );
  });

  it('propaga escopo nulo quando não há sessão (fail-closed)', async () => {
    await lastValueFrom(
      interceptor.intercept(createHttpContext(undefined), next),
    );

    expect(tenantContext.run).toHaveBeenCalledWith(
      { municipioId: null },
      expect.any(Function),
    );
  });

  it('propaga escopo nulo em contexto não-HTTP', async () => {
    const context = { getType: () => 'rpc' } as any;

    await lastValueFrom(interceptor.intercept(context, next));

    expect(tenantContext.run).toHaveBeenCalledWith(
      { municipioId: null },
      expect.any(Function),
    );
  });
});
