import { BadRequestException, ConfigService } from '@nestjs/common';
import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { EvidenceStorageService } from './evidence-storage.service';

describe('EvidenceStorageService', () => {
  const settings: Record<string, string> = {
    S3_ENDPOINT: 'https://objects.example.test',
    S3_REGION: 'us-east-1',
    S3_BUCKET: 'private-evidence',
    S3_ACCESS_KEY_ID: 'test-access-key',
    S3_SECRET_ACCESS_KEY: 'test-secret-key',
  };
  let service: EvidenceStorageService;
  let sendSpy: jest.SpyInstance;

  beforeEach(() => {
    const config = {
      get: jest.fn((key: string) => settings[key]),
    } as unknown as ConfigService;
    service = new EvidenceStorageService(config);
    sendSpy = jest.spyOn(S3Client.prototype, 'send').mockResolvedValue({} as never);
  });

  afterEach(() => {
    sendSpy.mockRestore();
  });

  it('stores only content-sniffed files under random municipality-scoped keys', async () => {
    const [stored] = await service.storeEvidence('funes', 'correlation-1', [
      {
        buffer: Buffer.from('%PDF-1.7 sample'),
        size: 15,
        originalname: 'factura.pdf',
        mimetype: 'text/plain',
      } as Express.Multer.File,
    ]);

    const command = sendSpy.mock.calls[0][0] as PutObjectCommand;
    expect(command.input.Bucket).toBe('private-evidence');
    expect(command.input.ContentType).toBe('application/pdf');
    expect(stored).toMatchObject({
      objectKey: expect.stringMatching(/^evidencias\/funes\/correlation-1\/.+\.pdf$/),
      nombreArchivo: 'factura.pdf',
      contentType: 'application/pdf',
      size: 15,
    });
    expect(stored.objectKey).not.toContain('factura.pdf');
  });

  it('rejects spoofed file extensions when the content signature is unsupported', async () => {
    await expect(
      service.storeEvidence('funes', 'correlation-1', [
        {
          buffer: Buffer.from('MZ executable'),
          size: 13,
          originalname: 'photo.jpg',
          mimetype: 'image/jpeg',
        } as Express.Multer.File,
      ]),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(sendSpy).not.toHaveBeenCalled();
  });

  it('detects MP4 video content independently of the declared MIME type', async () => {
    const buffer = Buffer.alloc(16);
    buffer.write('....ftypisom', 0, 'ascii');
    await service.storeEvidence('funes', 'correlation-1', [
      {
        buffer,
        size: buffer.length,
        originalname: 'video.bin',
        mimetype: 'application/octet-stream',
      } as Express.Multer.File,
    ]);

    const command = sendSpy.mock.calls[0][0] as PutObjectCommand;
    expect(command.input.ContentType).toBe('video/mp4');
    expect(command.input.Key).toMatch(/\.mp4$/);
  });

  it('cleans previously uploaded objects if a later upload fails', async () => {
    sendSpy
      .mockResolvedValueOnce({} as never)
      .mockRejectedValueOnce(new Error('storage unavailable'))
      .mockResolvedValueOnce({} as never);

    await expect(
      service.storeEvidence('funes', 'correlation-1', [
        {
          buffer: Buffer.from('%PDF-1.7 first'),
          size: 14,
          originalname: 'one.pdf',
          mimetype: 'application/pdf',
        } as Express.Multer.File,
        {
          buffer: Buffer.from('%PDF-1.7 second'),
          size: 15,
          originalname: 'two.pdf',
          mimetype: 'application/pdf',
        } as Express.Multer.File,
      ]),
    ).rejects.toMatchObject({ status: 503 });

    expect(sendSpy.mock.calls[2][0]).toBeInstanceOf(DeleteObjectCommand);
  });

  it('creates short-lived signed download URLs for private objects', async () => {
    const [evidence] = await service.storeEvidence('funes', 'correlation-1', [
      {
        buffer: Buffer.from('%PDF-1.7 sample'),
        size: 15,
        originalname: 'factura.pdf',
        mimetype: 'application/pdf',
      } as Express.Multer.File,
    ]);

    const url = await service.createDownloadUrl(evidence);
    expect(url).toContain('objects.example.test');
    expect(url).toContain('X-Amz-Expires=300');
  });
});