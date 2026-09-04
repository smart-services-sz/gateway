import { ForbiddenException } from '@nestjs/common';
import { RoutingController } from './routing.controller';
import { RoutingService } from './routing.service';

describe('RoutingController territorial scope', () => {
  const simulateMock = jest.fn().mockResolvedValue({ status: 'ok' });
  const generateMock = jest.fn().mockResolvedValue({ status: 'ok' });
  const assignedRouteMock = jest.fn().mockResolvedValue({ status: 'ok' });
  const service = {
    simulate: simulateMock,
    generate: generateMock,
    getAssignedRoute: assignedRouteMock,
  } as unknown as RoutingService;
  const controller = new RoutingController(service);

  beforeEach(() => {
    jest.clearAllMocks();
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
});
