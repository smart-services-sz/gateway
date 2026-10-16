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

  it('passes filters and authenticated request context to the audit service', () => {
    const query = { service: 'ms-auth', municipalityId: 'funes', page: 2, limit: 25 };
    const context = { userId: 'admin-1', ip: '127.0.0.1' };
    controller.getLogs(query, context);
    expect(getLogs).toHaveBeenCalledWith(query, context);
  });
});