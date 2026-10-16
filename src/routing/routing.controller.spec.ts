import { ForbiddenException } from '@nestjs/common';
import { RoutingController } from './routing.controller';
import { RoutingService } from './routing.service';
import { ROLES_KEY } from '../common/decorators/roles.decorator';
import { PERMISSIONS_KEY } from '../common/decorators/permissions.decorator';

describe('RoutingController territorial scope', () => {
  const simulateMock = jest.fn().mockResolvedValue({ status: 'ok' });
  const generateMock = jest.fn().mockResolvedValue({ status: 'ok' });
  const assignedRouteMock = jest.fn().mockResolvedValue({ status: 'ok' });
  const assignedRoutesMock = jest.fn().mockResolvedValue({ status: 'ok', data: [] });
  const attachInterventionEvidenceMock = jest
    .fn()
    .mockResolvedValue({ status: 'ok' });
  const service = {
    simulate: simulateMock,
    generate: generateMock,
    getAssignedRoute: assignedRouteMock,
    getAssignedRoutes: assignedRoutesMock,
    attachInterventionEvidence: attachInterventionEvidenceMock,
    getRules: jest.fn(), listPlans: jest.fn(), listAreaPlans: jest.fn(),
    upsertRules: jest.fn(), saveAreaPlan: jest.fn(), deleteAreaPlan: jest.fn(),
    getPlan: jest.fn(), confirmPlan: jest.fn(), deletePlan: jest.fn(),
    updateRouteStatus: jest.fn(), registerIntervention: jest.fn(),
    getMetrics: jest.fn(),
  } as unknown as RoutingService;
  const controller = new RoutingController(service);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('never lets an admin replace the municipality from the authenticated token', async () => {
    await controller.generate({ municipalityId: 'municipio_b' }, {
      user: { userId: 'admin-1', roles: ['ADMIN'], municipalityId: 'municipio_a' },
    } as never);
    expect(generateMock).toHaveBeenCalledWith({ municipalityId: 'municipio_a' });
  });

  it('locks route metrics to a municipal admin JWT and requires selection for platform admins', () => {
    const municipalAdmin = { userId: 'admin-a', roles: ['ADMIN'], municipalityId: 'municipio_a' };
    controller.getMetrics({ municipalityId: 'municipio_b' } as never, { user: municipalAdmin } as never);
    expect(service.getMetrics).toHaveBeenCalledWith({ municipalityId: 'municipio_b' }, 'municipio_a');

    const platformAdmin = { userId: 'admin-platform', roles: ['ADMIN'] };
    expect(() => controller.getMetrics({} as never, { user: platformAdmin } as never)).toThrow(ForbiddenException);
    controller.getMetrics({ municipalityId: 'municipio_b' } as never, { user: platformAdmin } as never);
    expect(service.getMetrics).toHaveBeenLastCalledWith({ municipalityId: 'municipio_b' }, 'municipio_b');
  });

  it('carries authenticated scope to all administrative reads and mutations', () => {
    const req = { user: { userId: 'admin-1', roles: ['ADMIN'], municipalityId: 'municipio_a' } } as never;
    controller.getRules(req); controller.listPlans(req); controller.listAreaPlans(req);
    controller.getPlan('plan-a', req); controller.confirmPlan('plan-a', req); controller.deletePlan('plan-a', req);
    controller.deleteAreaPlan('area-a', req);
    controller.upsertRules({ categoryRules: [], crews: [] }, req);
    controller.saveAreaPlan({} as never, req);
    for (const method of [service.getRules, service.listPlans, service.listAreaPlans]) expect(method).toHaveBeenCalledWith('municipio_a');
    for (const method of [service.getPlan, service.confirmPlan, service.deletePlan]) expect(method).toHaveBeenCalledWith('plan-a', 'municipio_a');
    expect(service.deleteAreaPlan).toHaveBeenCalledWith('area-a', 'municipio_a');
    expect(service.upsertRules).toHaveBeenCalledWith({ categoryRules: [], crews: [] }, 'municipio_a');
    expect(service.saveAreaPlan).toHaveBeenCalledWith({}, 'municipio_a');
  });

  it('rejects unscoped admins rather than using a global fallback', () => {
    const req = { user: { userId: 'admin-1', roles: ['ADMIN'] } } as never;
    for (const operation of [
      () => controller.generate({}, req), () => controller.getRules(req),
      () => controller.listPlans(req), () => controller.getPlan('plan-a', req),
      () => controller.upsertRules({ categoryRules: [], crews: [] }, req),
      () => controller.getAssignedRoutes(req),
    ]) expect(operation).toThrow(ForbiddenException);
  });

  it('overwrites client actor and municipality fields for operational writes', () => {
    const req = { user: { userId: 'agent-1', roles: ['AGENT'], municipalityId: 'municipio_a' } } as never;
    const spoofed = { municipalityId: 'municipio_b', actorId: 'other', actorIsAdmin: true };
    controller.updateRouteStatus(spoofed as never, req);
    controller.registerIntervention(spoofed as never, req);
    for (const method of [service.updateRouteStatus, service.registerIntervention]) expect(method).toHaveBeenCalledWith(expect.objectContaining({ municipalityId: 'municipio_a', actorId: 'agent-1', actorIsAdmin: false }));
  });

  it('lists only the authenticated operator routes', async () => {
    await controller.getAssignedRoutes({ user: { userId: 'agent-1', roles: ['AGENT'], permissions: [], municipalityId: 'funes' } } as never);
    expect(assignedRoutesMock).toHaveBeenCalledWith({ userId: 'agent-1', municipalityId: 'funes' });
  });

  it('reserves planning and route administration for ADMIN', () => {
    for (const method of [controller.simulate, controller.generate, controller.upsertRules, controller.getRules, controller.listAreaPlans, controller.listPlans, controller.saveAreaPlan, controller.deleteAreaPlan, controller.getPlan, controller.confirmPlan, controller.deletePlan]) {
      expect(Reflect.getMetadata(ROLES_KEY, method)).toEqual(['ADMIN']);
    }
  });

  it('allows operational access without general claims permissions', () => {
    for (const method of [controller.getAssignedRoutes, controller.getAssignedRoute, controller.updateRouteStatus, controller.registerIntervention, controller.attachInterventionEvidence]) {
      expect(Reflect.getMetadata(ROLES_KEY, method)).toContain('AGENT');
      expect(Reflect.getMetadata(PERMISSIONS_KEY, method)).toBeUndefined();
    }
  });

  it('overwrites client territorial filters with the authenticated operator scope', async () => {
    await controller.simulate(
      {
        municipalityId: 'client_municipality',
        areaId: 'client_area',
      },
      {
        user: {
          userId: 'agent-1',
          name: 'Agent',
          email: 'agent@test.local',
          roles: ['AGENT'],
          permissions: ['MANAGE_RECLAMOS'],
          cargo: 'Agent',
          legajo: '1',
          area: 'Centro',
          municipalityId: 'token_municipality',
          areaId: 'token_area',
        },
      } as never,
    );

    expect(simulateMock).toHaveBeenCalledWith({
      municipalityId: 'token_municipality',
      areaId: 'token_area',
    });
  });

  it('rejects operators without territorial scope', () => {
    expect(() =>
      controller.generate({}, {
        user: {
          userId: 'agent-1',
          name: 'Agent',
          email: 'agent@test.local',
          roles: ['AGENT'],
          permissions: ['MANAGE_RECLAMOS'],
          cargo: 'Agent',
          legajo: '1',
          area: 'Centro',
        },
      } as never),
    ).toThrow(ForbiddenException);
    expect(generateMock).not.toHaveBeenCalled();
  });

  it('forces assigned-route lookup to the authenticated operator', async () => {
    await controller.getAssignedRoute(
      { userId: 'other-agent', crewId: 'crew-1' },
      {
        user: {
          userId: 'agent-1',
          name: 'Agent',
          email: 'agent@test.local',
          roles: ['OFFICIAL'],
          municipalityId: 'funes',
          permissions: ['VIEW_RECLAMOS'],
          cargo: 'Official',
          legajo: '1',
          area: 'Centro',
        },
      } as never,
    );

    expect(assignedRouteMock).toHaveBeenCalledWith({
      userId: 'agent-1',
      crewId: undefined,
      municipalityId: 'funes',
    });
  });

  it('requires an evidence file and forwards the authenticated actor context', async () => {
    const file = {
      originalname: 'after.jpg',
      buffer: Buffer.from('image'),
    } as Express.Multer.File;
    const payload = { interventionId: '11111111-1111-4111-8111-111111111111' };
    const req = {
      user: {
        userId: 'agent-1',
        roles: ['AGENT'],
        municipalityId: 'funes',
      },
    };

    await controller.attachInterventionEvidence(
      payload as never,
      req as never,
      [file],
    );

    expect(attachInterventionEvidenceMock).toHaveBeenCalledWith(
      payload,
      file,
      {
        actorId: 'agent-1',
        actorIsAdmin: false,
        municipalityId: 'funes',
      },
    );
  });
});
