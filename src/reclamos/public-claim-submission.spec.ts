import { HttpStatus } from '@nestjs/common';
import { of } from 'rxjs';
import { RedisService } from '../redis/redis.service';
import { ReclamosService } from './reclamos.service';

describe('ReclamosService public claim submission', () => {
  const payload = {
    problema: 'Luminaria apagada en la esquina',
    direccion: 'San Martin 123',
    categoria: 'alumbrado',
    contacto: 'Vecino@Example.com',
  };
  let natsClient: { send: jest.Mock };
  let redisClient: { incr: jest.Mock; expire: jest.Mock };
  let evidenceStorage: {
    storeEvidence: jest.Mock;
    deleteEvidence: jest.Mock;
  };
  let service: ReclamosService;
  let previousMunicipalityId: string | undefined;
  let previousMunicipalityName: string | undefined;

  beforeEach(() => {
    previousMunicipalityId = process.env.PUBLIC_MUNICIPALITY_ID;
    previousMunicipalityName = process.env.PUBLIC_MUNICIPALITY_NAME;
    process.env.PUBLIC_MUNICIPALITY_ID = 'funes';
    process.env.PUBLIC_MUNICIPALITY_NAME = 'Funes';
    natsClient = { send: jest.fn() };
    redisClient = {
      incr: jest.fn().mockResolvedValue(1),
      expire: jest.fn().mockResolvedValue(true),
    };
    evidenceStorage = {
      storeEvidence: jest.fn().mockResolvedValue([]),
      deleteEvidence: jest.fn().mockResolvedValue(undefined),
    };
    service = new ReclamosService(
      natsClient as never,
      { getClient: () => redisClient } as unknown as RedisService,
      evidenceStorage as never,
    );
  });

  afterEach(() => {
    if (previousMunicipalityId === undefined) {
      delete process.env.PUBLIC_MUNICIPALITY_ID;
    } else {
      process.env.PUBLIC_MUNICIPALITY_ID = previousMunicipalityId;
    }
    if (previousMunicipalityName === undefined) {
      delete process.env.PUBLIC_MUNICIPALITY_NAME;
    } else {
      process.env.PUBLIC_MUNICIPALITY_NAME = previousMunicipalityName;
    }
  });

  it('geocodes, enforces locality, and creates a claim with server-owned fields', async () => {
    natsClient.send
      .mockReturnValueOnce(
        of({
          status: 'geocode_ok',
          data: {
            lat: -32.91,
            lng: -60.81,
            formattedAddress: 'San Martin 123, Funes, Santa Fe, Argentina',
            addressComponents: { locality: 'Funes' },
          },
        }),
      )
      .mockReturnValueOnce(
        of({ trackingCode: 'REC-ABC123', createdAt: '2026-10-14T12:00:00.000Z' }),
      );

    await expect(
      service.createPublic(payload, '203.0.113.10'),
    ).resolves.toMatchObject({
      status: 'created',
      trackingCode: 'REC-ABC123',
    });

    expect(natsClient.send).toHaveBeenNthCalledWith(
      1,
      'geo.geocode-address',
      expect.objectContaining({
        address: payload.direccion,
        city: 'Funes',
        country: 'Argentina',
      }),
    );
    expect(natsClient.send).toHaveBeenNthCalledWith(
      2,
      'reclamos.create',
      expect.objectContaining({
        canal: 'web',
        contactKey: 'web:email:vecino@example.com',
        correo: 'vecino@example.com',
        categoria: 'alumbrado',
        prioridad: 'media',
        municipalityId: 'funes',
        direccion: 'San Martin 123, Funes, Santa Fe, Argentina',
        lat: -32.91,
        lng: -60.81,
      }),
    );
  });

  it('does not create a claim when geocoding fails', async () => {
    natsClient.send.mockReturnValueOnce(
      of({ status: 'geocode_not_found', data: { lat: 0, lng: 0 } }),
    );

    await expect(
      service.createPublic(payload, '203.0.113.10'),
    ).rejects.toMatchObject({ status: HttpStatus.BAD_REQUEST });
    expect(natsClient.send).toHaveBeenCalledTimes(1);
    expect(natsClient.send).not.toHaveBeenCalledWith(
      'reclamos.create',
      expect.anything(),
    );
  });

  it('rejects a geocoded locality that does not match the configured municipality', async () => {
    natsClient.send.mockReturnValueOnce(
      of({
        status: 'geocode_ok',
        data: {
          lat: -32.95,
          lng: -60.65,
          addressComponents: { locality: 'Rosario' },
        },
      }),
    );

    await expect(
      service.createPublic(payload, '203.0.113.10'),
    ).rejects.toMatchObject({ status: HttpStatus.BAD_REQUEST });
    expect(natsClient.send).toHaveBeenCalledTimes(1);
  });

  it('blocks public submissions after the configured IP limit', async () => {
    redisClient.incr.mockResolvedValue(6);

    await expect(
      service.createPublic(payload, '203.0.113.10'),
    ).rejects.toMatchObject({ status: HttpStatus.TOO_MANY_REQUESTS });
    expect(natsClient.send).not.toHaveBeenCalled();
  });

  it('associates private evidence metadata with the created claim', async () => {
    const evidence = {
      objectKey: 'evidencias/funes/correlation/file.jpg',
      nombreArchivo: 'foto.jpg',
      contentType: 'image/jpeg',
      size: 20,
      uploadedAt: '2026-10-14T12:00:00.000Z',
    };
    evidenceStorage.storeEvidence.mockResolvedValue([evidence]);
    natsClient.send
      .mockReturnValueOnce(
        of({
          status: 'geocode_ok',
          data: {
            lat: -32.91,
            lng: -60.81,
            addressComponents: { locality: 'Funes' },
          },
        }),
      )
      .mockReturnValueOnce(of({ trackingCode: 'REC-ABC123' }));

    await service.createPublic(payload, '203.0.113.10', [
      { originalname: 'foto.jpg', buffer: Buffer.from('image') } as never,
    ]);

    expect(evidenceStorage.storeEvidence).toHaveBeenCalledWith(
      'funes',
      expect.any(String),
      expect.any(Array),
    );
    expect(natsClient.send).toHaveBeenNthCalledWith(
      2,
      'reclamos.create',
      expect.objectContaining({
        metadata: expect.objectContaining({ evidencias: [evidence] }),
      }),
    );
  });

  it('removes stored evidence if claim persistence fails', async () => {
    const evidence = {
      objectKey: 'evidencias/funes/correlation/file.jpg',
      nombreArchivo: 'foto.jpg',
      contentType: 'image/jpeg',
      size: 20,
      uploadedAt: '2026-10-14T12:00:00.000Z',
    };
    evidenceStorage.storeEvidence.mockResolvedValue([evidence]);
    natsClient.send
      .mockReturnValueOnce(
        of({
          status: 'geocode_ok',
          data: {
            lat: -32.91,
            lng: -60.81,
            addressComponents: { locality: 'Funes' },
          },
        }),
      )
      .mockImplementationOnce(() => {
        throw new Error('claim persistence failed');
      });

    await expect(
      service.createPublic(payload, '203.0.113.10', [
        { originalname: 'foto.jpg', buffer: Buffer.from('image') } as never,
      ]),
    ).rejects.toBeInstanceOf(Error);
    expect(evidenceStorage.deleteEvidence).toHaveBeenCalledWith([evidence]);
  });
});