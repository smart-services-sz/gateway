import { ForbiddenException } from '@nestjs/common';
import { of, throwError } from 'rxjs';
import { EvidenceStorageService } from '../reclamos/evidence-storage.service';
import { RoutingService } from './routing.service';

describe('RoutingService intervention evidence', () => {
  const interventionId = '11111111-1111-4111-8111-111111111111';
  const file = {
    originalname: 'after.pdf',
    buffer: Buffer.from('%PDF-1.7 sample'),
    size: 15,
    mimetype: 'application/pdf',
  } as Express.Multer.File;
  const storedEvidence = {
    objectKey: 'evidencias/funes/intervention-1/evidence-1.pdf',
    nombreArchivo: 'after.pdf',
    contentType: 'application/pdf',
    size: 15,
    uploadedAt: '2026-10-14T12:00:00.000Z',
  };
  let natsClient: { send: jest.Mock };
  let storage: {
    storeEvidence: jest.Mock;
    deleteEvidence: jest.Mock;
    createDownloadUrl: jest.Mock;
  };
  let service: RoutingService;

  beforeEach(() => {
    natsClient = { send: jest.fn() };
    storage = {
      storeEvidence: jest.fn().mockResolvedValue([storedEvidence]),
      deleteEvidence: jest.fn().mockResolvedValue(undefined),
      createDownloadUrl: jest
        .fn()
        .mockResolvedValue('https://wasabi.example/signed-evidence'),
    };
    service = new RoutingService(
      natsClient as never,
      storage as unknown as EvidenceStorageService,
    );
  });

  it('rejects an unassigned intervention before writing to S3', async () => {
    natsClient.send.mockReturnValueOnce(
      of({ status: 'ok', data: [{ stops: [{ intervention: { id: 'other' } }] }] }),
    );

    await expect(
      service.attachInterventionEvidence(
        { interventionId },
        file,
        { actorId: 'agent-1', actorIsAdmin: false, municipalityId: 'funes' },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(storage.storeEvidence).not.toHaveBeenCalled();
    expect(natsClient.send).toHaveBeenCalledTimes(1);
  });

  it('adds the trusted municipal scope to every administrative NATS request', async () => {
    natsClient.send.mockReturnValue(of({ status: 'ok', data: [] }));
    const municipalityId = 'funes';
    await service.getRules(municipalityId);
    await service.listPlans(municipalityId);
    await service.listAreaPlans(municipalityId);
    await service.getPlan('plan-1', municipalityId);
    await service.confirmPlan('plan-1', municipalityId);
    await service.deletePlan('plan-1', municipalityId);
    await service.deleteAreaPlan('area-1', municipalityId);
    await service.upsertRules({ categoryRules: [], crews: [], municipalityId: 'spoofed' } as never, municipalityId);
    await service.saveAreaPlan({ municipalityId: 'spoofed' } as never, municipalityId);
    for (const [, payload] of natsClient.send.mock.calls) {
      expect(payload).toEqual(expect.objectContaining({ municipalityId }));
    }
    expect(natsClient.send).toHaveBeenCalledTimes(9);
  });

  it('rejects an admin without a municipality before uploading evidence', async () => {
    await expect(service.attachInterventionEvidence({ interventionId }, file, {
      actorId: 'admin-1', actorIsAdmin: true,
    })).rejects.toBeInstanceOf(ForbiddenException);
    expect(storage.storeEvidence).not.toHaveBeenCalled();
    expect(natsClient.send).not.toHaveBeenCalled();
  });

  it('stores and attaches a private object key after verifying route assignment', async () => {
    natsClient.send
      .mockReturnValueOnce(
        of({
          status: 'ok',
          data: [{ stops: [{ intervention: { id: interventionId } }] }],
        }),
      )
      .mockReturnValueOnce(
        of({
          status: 'ok',
          data: {
            id: 'evidence-1',
            tipo: 'documento',
            nombreArchivo: 'after.pdf',
            urlArchivo: storedEvidence.objectKey,
          },
        }),
      );

    await expect(
      service.attachInterventionEvidence(
        { interventionId, descripcion: 'Luego del trabajo' },
        file,
        { actorId: 'agent-1', actorIsAdmin: false, municipalityId: 'funes' },
      ),
    ).resolves.toMatchObject({
      data: {
        id: 'evidence-1',
        urlArchivo: 'https://wasabi.example/signed-evidence',
      },
    });

    expect(storage.storeEvidence).toHaveBeenCalledWith(
      'funes',
      interventionId,
      [file],
    );
    expect(natsClient.send).toHaveBeenNthCalledWith(1, 'routing.assigned-routes.list', { userId: 'agent-1', municipalityId: 'funes' });
    expect(natsClient.send).toHaveBeenNthCalledWith(
      2,
      'routing.intervention.evidence.attach',
      expect.objectContaining({
        interventionId,
        objectKey: storedEvidence.objectKey,
        tipo: 'documento',
        actorId: 'agent-1',
        actorIsAdmin: false,
        municipalityId: 'funes',
      }),
    );
    expect(storage.createDownloadUrl).toHaveBeenCalledWith(
      expect.objectContaining({ objectKey: storedEvidence.objectKey }),
    );
  });

  it('removes the uploaded file when MS-Routing rejects the attachment', async () => {
    natsClient.send
      .mockReturnValueOnce(
        of({
          status: 'ok',
          data: [{ stops: [{ intervention: { id: interventionId } }] }],
        }),
      )
      .mockReturnValueOnce(
        throwError(() => ({ message: 'persist failed', statusCode: 502 })),
      );

    await expect(
      service.attachInterventionEvidence(
        { interventionId },
        file,
        { actorId: 'agent-1', actorIsAdmin: false, municipalityId: 'funes' },
      ),
    ).rejects.toMatchObject({ status: 502 });
    expect(storage.deleteEvidence).toHaveBeenCalledWith([storedEvidence]);
  });

  it('signs stored evidence while listing assigned routes', async () => {
    natsClient.send.mockReturnValueOnce(
      of({
        status: 'ok',
        data: [
          {
            id: 'route-1',
            stops: [
              {
                intervention: {
                  id: interventionId,
                  evidences: [
                    {
                      urlArchivo: storedEvidence.objectKey,
                      nombreArchivo: 'after.pdf',
                    },
                  ],
                },
              },
            ],
          },
        ],
      }),
    );

    await expect(service.getAssignedRoutes({ userId: 'agent-1', municipalityId: 'funes' })).resolves.toMatchObject({
      data: [
        {
          stops: [
            {
              intervention: {
                evidences: [
                  { urlArchivo: 'https://wasabi.example/signed-evidence' },
                ],
              },
            },
          ],
        },
      ],
    });
  });
});