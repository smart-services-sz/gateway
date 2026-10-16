import { of } from 'rxjs';
import {
  AUDIT_NATS_CLIENT,
  AUDIT_SERVICE_NAME,
  AuditLoggingInterceptor,
} from './audit-logging.interceptor';

describe('AuditLoggingInterceptor', () => {
  it('audits an HTTP outcome without copying request or response content', async () => {
    const emit = jest.fn().mockReturnValue(of(undefined));
    const interceptor = new AuditLoggingInterceptor(
      { emit } as never,
      'gateway',
    );
    const request = {
      method: 'POST',
      path: '/api/reclamos/public',
      route: { path: '/reclamos/public' },
      headers: {
        'x-correlation-id': '123e4567-e89b-42d3-a456-426614174000',
        authorization: 'Bearer sensitive-token',
      },
      body: { contacto: 'citizen@example.com', problema: 'Sensitive content' },
      user: { userId: 'admin-1', municipalityId: 'funes' },
    };
    const response = { statusCode: 201, setHeader: jest.fn() };
    const executionContext = {
      getType: () => 'http',
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => response,
      }),
    };

    interceptor.intercept(executionContext as never, { handle: () => of({ contacto: 'citizen@example.com' }) } as never).subscribe();

    expect(response.setHeader).toHaveBeenCalledWith(
      'x-correlation-id',
      '123e4567-e89b-42d3-a456-426614174000',
    );
    expect(emit).toHaveBeenCalledWith('audit.log', expect.objectContaining({
      service: 'gateway',
      action: 'HTTP.POST./reclamos/public.SUCCESS',
      entity: 'Reclamo',
      performedBy: 'admin-1',
      municipalityId: 'funes',
      correlationId: '123e4567-e89b-42d3-a456-426614174000',
      metadata: expect.objectContaining({ transport: 'http', outcome: 'success', statusCode: 201 }),
    }));
    const serialized = JSON.stringify(emit.mock.calls[0][1]);
    expect(serialized).not.toContain('citizen@example.com');
    expect(serialized).not.toContain('Sensitive content');
    expect(serialized).not.toContain('sensitive-token');
    expect(AUDIT_NATS_CLIENT).toBe('AUDIT_NATS_CLIENT');
    expect(AUDIT_SERVICE_NAME).toBe('AUDIT_SERVICE_NAME');
  });
});