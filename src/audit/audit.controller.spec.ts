import { ROLES_KEY } from '../common/decorators/roles.decorator';
import { AuditController } from './audit.controller';
import { AuditGatewayService } from './audit.service';

describe('AuditController', () => {
  const getLogs = jest.fn();
  const controller = new AuditController({ getLogs } as unknown as AuditGatewayService);

  beforeEach(() => jest.clearAllMocks());

  it('limits audit queries to ADMIN', () => {
    expect(Reflect.getMetadata(ROLES_KEY, AuditController)).toEqual(['ADMIN']);
  });

  it('passes filters and authenticated request context to a platform admin', () => {
    const query = { service: 'ms-auth', municipalityId: 'funes', page: 2, limit: 25 };
    const context = { userId: 'admin-1', ip: '127.0.0.1' };
    controller.getLogs(query, context, { userId: 'admin-1', roles: ['ADMIN'] } as never);
    expect(getLogs).toHaveBeenCalledWith(query, context);
  });

  it('overwrites requested municipality with the authenticated municipal admin scope', () => {
    const query = { service: 'ms-auth', municipalityId: 'municipio-b', page: 1, limit: 20 };
    const context = { userId: 'admin-a', ip: '127.0.0.1' };
    controller.getLogs(query, context, {
      userId: 'admin-a', roles: ['ADMIN'], municipalityId: 'municipio-a',
    } as never);
    expect(getLogs).toHaveBeenCalledWith({ ...query, municipalityId: 'municipio-a' }, context);
  });
});