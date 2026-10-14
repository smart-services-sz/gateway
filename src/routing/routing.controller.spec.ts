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
  } as unknown as RoutingService;
  const controller = new RoutingController(service);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('lists only the authenticated operator routes', async () => {
    await controller.getAssignedRoutes({ user: { userId: 'agent-1', roles: ['AGENT'], permissions: [] } } as never);
    expect(assignedRoutesMock).toHaveBeenCalledWith({ userId: 'agent-1' });
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
        municipalityId: 'client-municipality',
        areaId: 'client-area',
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
          municipalityId: 'token-municipality',
          areaId: 'token-area',
        },
      } as never,
    );

    expect(simulateMock).toHaveBeenCalledWith({
      municipalityId: 'token-municipality',
      areaId: 'token-area',
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
