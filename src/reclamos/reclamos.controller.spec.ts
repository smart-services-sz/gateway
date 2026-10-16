import { ForbiddenException } from '@nestjs/common';
import { JwtUser } from '../common/decorators/current-user.dto';
import { ReclamosService } from './reclamos.service';
import { ReclamosController } from './reclamos.controller';
import { IS_PUBLIC_KEY } from '../auth/decorators/public.decorator';

describe('ReclamosController territorial scope', () => {
  const reclamosService = {
    create: jest.fn(),
    getPublicConfiguration: jest.fn(),
    createPublic: jest.fn(),
    getPublicTracking: jest.fn(),
    getMetrics: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    getHistory: jest.fn(),
    reviewResolution: jest.fn(),
    requestNewVisit: jest.fn(),
    close: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  } as unknown as ReclamosService;
  const controller = new ReclamosController(reclamosService);

  const agent: JwtUser = {
    userId: 'agent-1',
    name: 'Agent',
    email: 'agent@test.local',
    roles: ['AGENT'],
    cargo: 'Agent',
    legajo: '1',
    area: 'Centro',
    municipalityId: 'municipality-a',
    areaId: 'area-a',
  };

  const request = (user: JwtUser) => ({ user }) as never;

  beforeEach(() => jest.clearAllMocks());

  it('requires an administrative role for legacy creation rather than exposing a public bypass', () => {
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, controller.create)).not.toBe(true);
    expect(Reflect.getMetadata('roles', controller.create)).toEqual(['ADMIN', 'AGENT']);
  });

  it('overwrites the administrative creation scope with the authenticated territory', () => {
    controller.create({ municipalityId: 'municipality-b', areaId: 'area-b' } as never, request(agent));
    expect(reclamosService.create).toHaveBeenCalledWith({
      municipalityId: agent.municipalityId, areaId: agent.areaId,
    });
  });

  it('rejects administrative creation by an unscoped agent', () => {
    expect(() => controller.create({} as never, request({ ...agent, municipalityId: undefined })))
      .toThrow(ForbiddenException);
    expect(reclamosService.create).not.toHaveBeenCalled();
  });

  it('exposes the safe municipal configuration publicly', () => {
    controller.getPublicConfiguration();
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, controller.getPublicConfiguration)).toBe(true);
    expect(reclamosService.getPublicConfiguration).toHaveBeenCalledTimes(1);
  });

  it('overwrites list filters with the authenticated agent scope', () => {
    controller.findAll(
      { municipalityId: 'municipality-b', areaId: 'area-b' } as never,
      request(agent),
    );

    expect(reclamosService.findAll).toHaveBeenCalledWith({
      municipalityId: 'municipality-a',
      areaId: 'area-a',
    });
  });

  it('rejects agents without municipality or area scope', () => {
    const unscopedAgent = { ...agent, municipalityId: undefined, areaId: undefined };

    expect(() => controller.findAll({} as never, request(unscopedAgent))).toThrow(
      ForbiddenException,
    );
    expect(reclamosService.findAll).not.toHaveBeenCalled();
  });

  it('forces a municipal admin metrics query to the JWT municipality', () => {
    controller.getMetrics({ municipalityId: 'municipality-b', areaId: 'area-b' } as never, request({ ...agent, roles: ['ADMIN'] }));
    expect(reclamosService.getMetrics).toHaveBeenCalledWith(
      expect.objectContaining({ municipalityId: 'municipality-b', areaId: 'area-b' }),
      { municipalityId: 'municipality-a', areaId: 'area-a' },
    );
  });

  it('requires a selected municipality for a platform admin metrics query', () => {
    const platformAdmin = { ...agent, roles: ['ADMIN'], municipalityId: undefined, areaId: undefined };
    expect(() => controller.getMetrics({} as never, request(platformAdmin))).toThrow(ForbiddenException);
    expect(reclamosService.getMetrics).not.toHaveBeenCalled();
    controller.getMetrics({ municipalityId: 'municipality-b' } as never, request(platformAdmin));
    expect(reclamosService.getMetrics).toHaveBeenCalledWith(
      expect.objectContaining({ municipalityId: 'municipality-b' }),
      { municipalityId: 'municipality-b' },
    );
  });

  it('passes the authenticated scope to detail and history lookups', () => {
    controller.findOne('claim-id', request(agent));
    controller.getHistory('claim-id', request(agent));

    expect(reclamosService.findOne).toHaveBeenCalledWith('claim-id', {
      municipalityId: 'municipality-a',
      areaId: 'area-a',
    });
    expect(reclamosService.getHistory).toHaveBeenCalledWith('claim-id', {
      municipalityId: 'municipality-a',
      areaId: 'area-a',
    });
  });

  it('passes the authenticated scope to every administrative mutation', () => {
    const req = request(agent);
    controller.reviewResolution('claim-id', { resultado: 'aprobada' } as never, req);
    controller.requestNewVisit('claim-id', { motivo: 'Verificar' } as never, req);
    controller.close('claim-id', { motivo: 'Cerrado' } as never, req);
    controller.update('claim-id', {} as never, req);
    controller.remove('claim-id', req);

    const scope = { municipalityId: 'municipality-a', areaId: 'area-a' };
    expect(reclamosService.reviewResolution).toHaveBeenCalledWith(
      expect.objectContaining({ reclamoId: 'claim-id', actorId: agent.userId }),
      scope,
    );
    expect(reclamosService.requestNewVisit).toHaveBeenCalledWith(
      expect.objectContaining({ reclamoId: 'claim-id', actorId: agent.userId }),
      scope,
    );
    expect(reclamosService.close).toHaveBeenCalledWith(
      expect.objectContaining({ reclamoId: 'claim-id', actorId: agent.userId }),
      scope,
    );
    expect(reclamosService.update).toHaveBeenCalledWith('claim-id', {}, scope);
    expect(reclamosService.remove).toHaveBeenCalledWith('claim-id', scope);
  });

  it('allows an unscoped platform admin to use explicit tenant filters', () => {
    controller.findAll(
      { municipalityId: 'municipality-b' } as never,
      request({ ...agent, roles: ['ADMIN'], municipalityId: undefined, areaId: undefined }),
    );

    expect(reclamosService.findAll).toHaveBeenCalledWith({
      municipalityId: 'municipality-b',
    });
  });

  it('forwards public tracking credentials and requester IP', () => {
    const payload = {
      codigoSeguimiento: 'REC-ABC123',
      contacto: '+54 9 341 555 1234',
    };

    controller.getPublicTracking(payload, {
      ip: '203.0.113.10',
      socket: { remoteAddress: '127.0.0.1' },
    } as never);

    expect(reclamosService.getPublicTracking).toHaveBeenCalledWith(
      payload,
      '203.0.113.10',
    );
  });

  it('forwards the public submission and requester IP', () => {
    const payload = {
      problema: 'Luminaria apagada',
      direccion: 'San Martin 123, Funes',
      categoria: 'alumbrado',
      contacto: 'vecino@example.com',
    };

    controller.createPublic(payload as never, {
      ip: '203.0.113.11',
      socket: { remoteAddress: '127.0.0.1' },
    } as never, []);

    expect(reclamosService.createPublic).toHaveBeenCalledWith(
      payload,
      '203.0.113.11',
      [],
    );
  });
});