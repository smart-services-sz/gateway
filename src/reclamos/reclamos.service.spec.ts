import { HttpException, HttpStatus } from '@nestjs/common';
import { of } from 'rxjs';
import { RedisService } from '../redis/redis.service';
import { ReclamosService } from './reclamos.service';

describe('ReclamosService public tracking', () => {
  const payload = {
    codigoSeguimiento: 'REC-ABC123',
    contacto: '+54 9 341 555 1234',
  };
  let natsClient: { send: jest.Mock };
  let redisClient: { incr: jest.Mock; expire: jest.Mock };
  let evidenceStorage: {
    storeEvidence: jest.Mock;
    deleteEvidence: jest.Mock;
    createDownloadUrl: jest.Mock;
  };
  let service: ReclamosService;
  let originalMunicipalityId: string | undefined;
  let originalMunicipalityName: string | undefined;

  beforeEach(() => {
    originalMunicipalityId = process.env.PUBLIC_MUNICIPALITY_ID;
    originalMunicipalityName = process.env.PUBLIC_MUNICIPALITY_NAME;
    process.env.PUBLIC_MUNICIPALITY_ID = 'funes';
    process.env.PUBLIC_MUNICIPALITY_NAME = 'Funes';
    natsClient = { send: jest.fn().mockReturnValue(of({ status: 'ok' })) };
    redisClient = {
      incr: jest.fn().mockResolvedValue(1),
      expire: jest.fn().mockResolvedValue(true),
    };
    evidenceStorage = {
      storeEvidence: jest.fn().mockResolvedValue([]),
      deleteEvidence: jest.fn().mockResolvedValue(undefined),
      createDownloadUrl: jest.fn().mockResolvedValue('https://signed.example/file'),
    };
    service = new ReclamosService(
      natsClient as never,
      { getClient: () => redisClient } as unknown as RedisService,
      evidenceStorage as never,
    );
  });

  afterEach(() => {
    if (originalMunicipalityId === undefined) {
      delete process.env.PUBLIC_MUNICIPALITY_ID;
    } else {
      process.env.PUBLIC_MUNICIPALITY_ID = originalMunicipalityId;
    }
    if (originalMunicipalityName === undefined) {
      delete process.env.PUBLIC_MUNICIPALITY_NAME;
    } else {
      process.env.PUBLIC_MUNICIPALITY_NAME = originalMunicipalityName;
    }
  });

  it('rate-limits by a hashed client IP before querying NATS', async () => {
    await service.getPublicTracking(payload, '203.0.113.10');

    const [pattern, natsPayload] = natsClient.send.mock.calls[0];
    expect(pattern).toBe('reclamos.public-tracking');
    expect(natsPayload).toEqual(payload);
    expect(redisClient.incr.mock.calls[0][0]).toMatch(
      /^smartservice:public-tracking:ratelimit:[a-f0-9]{64}$/,
    );
    expect(redisClient.expire).toHaveBeenCalledWith(
      redisClient.incr.mock.calls[0][0],
      900,
    );
  });

  it('blocks the eleventh lookup within the rate-limit window', async () => {
    redisClient.incr.mockResolvedValue(11);

    await expect(
      service.getPublicTracking(payload, '203.0.113.10'),
    ).rejects.toMatchObject({ status: HttpStatus.TOO_MANY_REQUESTS });
    expect(natsClient.send).not.toHaveBeenCalled();
  });

  it('fails closed when Redis cannot enforce the rate limit', async () => {
    redisClient.incr.mockRejectedValue(new Error('Redis unavailable'));

    await expect(
      service.getPublicTracking(payload, '203.0.113.10'),
    ).rejects.toMatchObject({ status: HttpStatus.SERVICE_UNAVAILABLE });
    expect(natsClient.send).not.toHaveBeenCalled();
  });

  it('returns signed evidence links without leaking private object keys', async () => {
    const claim = {
      id: 'claim-1',
      problema: 'Bache',
      metadata: {
        source: 'public-web',
        evidencias: [
          {
            objectKey: 'evidencias/funes/correlation/file.pdf',
            nombreArchivo: 'foto.pdf',
            contentType: 'application/pdf',
            size: 15,
            uploadedAt: '2026-10-14T12:00:00.000Z',
          },
        ],
      },
    };
    natsClient.send.mockReturnValueOnce(of(claim));

    const response = await service.findOne('claim-1', {
      municipalityId: 'funes',
    });
    expect(response).toMatchObject({
      id: 'claim-1',
      metadata: { source: 'public-web' },
      evidencias: [
        {
          nombreArchivo: 'foto.pdf',
          url: 'https://signed.example/file',
        },
      ],
      evidenciasCount: 1,
    });

    expect(JSON.stringify(response)).not.toContain(
      'evidencias/funes/correlation/file.pdf',
    );
    expect(evidenceStorage.createDownloadUrl).toHaveBeenCalledWith(
      expect.objectContaining({
        objectKey: 'evidencias/funes/correlation/file.pdf',
      }),
    );
  });

  it('strips private evidence keys from list responses', async () => {
    natsClient.send.mockReturnValueOnce(
      of({
        items: [
          {
            id: 'claim-1',
            metadata: {
              source: 'public-web',
              evidencias: [
                {
                  objectKey: 'evidencias/funes/correlation/file.pdf',
                  nombreArchivo: 'foto.pdf',
                },
              ],
            },
          },
        ],
        pagination: { totalItems: 1 },
      }),
    );
    const response = (await service.findAll({} as never)) as {
      items: Array<{
        metadata: Record<string, unknown>;
        evidenciasCount: number;
      }>;
    };
    expect(response.items[0]).toMatchObject({
      metadata: { source: 'public-web' },
      evidenciasCount: 1,
    });
    expect(JSON.stringify(response)).not.toContain(
      'evidencias/funes/correlation/file.pdf',
    );
  });

  it('cleans stored evidence if claim creation returns no tracking code', async () => {
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
      .mockReturnValueOnce(of({ status: 'created' }));

    await expect(
      service.createPublic(
        {
          problema: 'Bache',
          direccion: 'San Martin 123',
          categoria: 'alumbrado',
          contacto: 'vecino@example.com',
        },
        '203.0.113.10',
        [{ originalname: 'foto.jpg', buffer: Buffer.from('image') } as never],
      ),
    ).rejects.toMatchObject({ status: HttpStatus.BAD_GATEWAY });
    expect(evidenceStorage.deleteEvidence).toHaveBeenCalledWith([evidence]);
  });
});