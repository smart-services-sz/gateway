import {
  BadRequestException,
  HttpException,
  Injectable,
  Logger,
  OnModuleDestroy,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'node:crypto';

export type EvidenceUploadFile = Express.Multer.File;

export type StoredEvidence = {
  objectKey: string;
  nombreArchivo: string;
  contentType: string;
  size: number;
  uploadedAt: string;
};

type EvidenceContentType =
  | 'image/jpeg'
  | 'image/png'
  | 'image/webp'
  | 'video/mp4'
  | 'application/pdf';

type ValidatedEvidence = {
  file: EvidenceUploadFile;
  contentType: EvidenceContentType;
  extension: 'jpg' | 'png' | 'webp' | 'mp4' | 'pdf';
  nombreArchivo: string;
};

@Injectable()
export class EvidenceStorageService implements OnModuleDestroy {
  private readonly logger = new Logger(EvidenceStorageService.name);
  private readonly maxFiles = 3;
  private readonly maxFileSize = 5 * 1024 * 1024;
  private readonly signedUrlTtlSeconds = 300;
  private client?: S3Client;
  private bucket?: string;

  constructor(private readonly configService: ConfigService) {}

  onModuleDestroy(): void {
    this.client?.destroy();
    this.client = undefined;
    this.bucket = undefined;
  }

  async storeEvidence(
    municipalityId: string,
    correlationId: string,
    files: EvidenceUploadFile[],
  ): Promise<StoredEvidence[]> {
    if (files.length === 0) return [];
    if (files.length > this.maxFiles) {
      throw new BadRequestException('Se permiten hasta 3 evidencias por reclamo.');
    }

    const validatedFiles = files.map((file) => this.validateFile(file));
    const { client, bucket } = this.getStorage();
    const stored: StoredEvidence[] = [];

    try {
      for (const evidence of validatedFiles) {
        const objectKey = [
          'evidencias',
          municipalityId,
          correlationId,
          `${randomUUID()}.${evidence.extension}`,
        ].join('/');

        await client.send(
          new PutObjectCommand({
            Bucket: bucket,
            Key: objectKey,
            Body: evidence.file.buffer,
            ContentLength: evidence.file.size,
            ContentType: evidence.contentType,
            Metadata: { correlationid: correlationId },
          }),
        );

        stored.push({
          objectKey,
          nombreArchivo: evidence.nombreArchivo,
          contentType: evidence.contentType,
          size: evidence.file.size,
          uploadedAt: new Date().toISOString(),
        });
      }

      return stored;
    } catch (error: unknown) {
      await this.deleteEvidence(stored);
      if (error instanceof HttpException) throw error;
      this.logger.error('No se pudo almacenar la evidencia en S3');
      throw new ServiceUnavailableException(
        'El almacenamiento de evidencias no esta disponible.',
      );
    }
  }

  async createDownloadUrl(
    evidence: Pick<StoredEvidence, 'objectKey' | 'nombreArchivo'>,
  ): Promise<string> {
    const { client, bucket } = this.getStorage();
    if (!evidence.objectKey.startsWith('evidencias/') || evidence.objectKey.includes('..')) {
      throw new BadRequestException('La referencia de evidencia no es valida.');
    }

    return getSignedUrl(
      client,
      new GetObjectCommand({
        Bucket: bucket,
        Key: evidence.objectKey,
        ResponseContentDisposition: `attachment; filename="${evidence.nombreArchivo}"`,
      }),
      { expiresIn: this.signedUrlTtlSeconds },
    );
  }

  async deleteEvidence(evidences: StoredEvidence[]): Promise<void> {
    if (evidences.length === 0) return;
    const { client, bucket } = this.getStorage();

    const results = await Promise.allSettled(
      evidences.map((evidence) =>
        client.send(
          new DeleteObjectCommand({ Bucket: bucket, Key: evidence.objectKey }),
        ),
      ),
    );
    if (results.some((result) => result.status === 'rejected')) {
      this.logger.error('No se pudieron limpiar todos los objetos de evidencia.');
    }
  }

  private validateFile(file: EvidenceUploadFile): ValidatedEvidence {
    if (!file.buffer || file.size !== file.buffer.length) {
      throw new BadRequestException('El archivo de evidencia esta vacio o invalido.');
    }
    if (file.size > this.maxFileSize) {
      throw new BadRequestException('Cada evidencia debe pesar como maximo 5 MB.');
    }

    const type = this.detectFileType(file.buffer);
    if (!type) {
      throw new BadRequestException(
        'Solo se admiten imagenes JPEG, PNG, WebP o documentos PDF.',
      );
    }

    return {
      file,
      ...type,
      nombreArchivo: file.originalname
        .normalize('NFKC')
        .replace(/[\r\n"\\/]/g, '_')
        .slice(0, 160),
    };
  }

  private detectFileType(
    buffer: Buffer,
  ): Pick<ValidatedEvidence, 'contentType' | 'extension'> | undefined {
    if (
      buffer.length >= 8 &&
      buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    ) {
      return { contentType: 'image/png', extension: 'png' };
    }
    if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
      return { contentType: 'image/jpeg', extension: 'jpg' };
    }
    if (
      buffer.length >= 12 &&
      buffer.toString('ascii', 0, 4) === 'RIFF' &&
      buffer.toString('ascii', 8, 12) === 'WEBP'
    ) {
      return { contentType: 'image/webp', extension: 'webp' };
    }
    if (
      buffer.length >= 12 &&
      buffer.toString('ascii', 4, 8) === 'ftyp'
    ) {
      return { contentType: 'video/mp4', extension: 'mp4' };
    }
    if (buffer.length >= 5 && buffer.toString('ascii', 0, 5) === '%PDF-') {
      return { contentType: 'application/pdf', extension: 'pdf' };
    }
    return undefined;
  }

  private getStorage(): { client: S3Client; bucket: string } {
    const endpoint = this.configService.get<string>('S3_ENDPOINT')?.trim();
    const region = this.configService.get<string>('S3_REGION')?.trim();
    const bucket = this.configService.get<string>('S3_BUCKET')?.trim();
    const accessKeyId = this.configService
      .get<string>('S3_ACCESS_KEY_ID')
      ?.trim();
    const secretAccessKey = this.configService
      .get<string>('S3_SECRET_ACCESS_KEY')
      ?.trim();

    if (!endpoint || !region || !bucket || !accessKeyId || !secretAccessKey) {
      throw new ServiceUnavailableException(
        'El almacenamiento de evidencias no esta configurado.',
      );
    }

    if (!this.client || this.bucket !== bucket) {
      this.client?.destroy();
      this.client = new S3Client({
        endpoint,
        region,
        forcePathStyle:
          this.configService.get<string>('S3_FORCE_PATH_STYLE') === 'true',
        credentials: { accessKeyId, secretAccessKey },
      });
      this.bucket = bucket;
    }

    return { client: this.client, bucket };
  }
}