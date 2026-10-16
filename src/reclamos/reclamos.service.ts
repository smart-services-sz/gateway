import {
  BadGatewayException,
  BadRequestException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom, timeout } from 'rxjs';
import { RedisService } from '../redis/redis.service';
import { CreateReclamoDto } from './dto/create-reclamo.dto';
import { FindReclamosDto } from './dto/find-reclamos.dto';
import { PublicTrackingDto } from './dto/public-tracking.dto';
import { UpdateReclamoDto } from './dto/update-reclamo.dto';
import { ReviewResolutionDto } from './dto/review-resolution.dto';
import { RequestNewVisitDto } from './dto/request-new-visit.dto';
import { CloseReclamoDto } from './dto/close-reclamo.dto';
import { ReclamoMetricsQueryDto } from './dto/reclamo-metrics-query.dto';
import { PUBLIC_CLAIM_CATEGORIES, PublicClaimSubmissionDto } from './dto/public-claim-submission.dto';
import type { MunicipalityConfigurationDto } from '../municipal-config/dto/municipality-configuration.dto';
import {
  EvidenceStorageService,
  EvidenceUploadFile,
  StoredEvidence,
} from './evidence-storage.service';

type ReclamoTerritorialScope = {
  municipalityId?: string;
  areaId?: string;
};

@Injectable()
export class ReclamosService {
  private readonly logger = new Logger(ReclamosService.name);

  constructor(
    @Inject('NATS_CLIENT') private readonly natsClient: ClientProxy,
    private readonly redisService: RedisService,
    private readonly evidenceStorage: EvidenceStorageService,
  ) {}

  create(payload: CreateReclamoDto) {
    return this.request('reclamos.create', payload);
  }

  async findAll(query: FindReclamosDto) {
    const response = await this.request<unknown>('reclamos.find-all', query);
    if (!this.isRecord(response) || !Array.isArray(response.items)) {
      return response;
    }
    return {
      ...response,
      items: response.items.map((item) =>
        this.isRecord(item) ? this.sanitizeEvidenceMetadata(item) : item,
      ),
    };
  }

  getMetrics(query: ReclamoMetricsQueryDto, scope: ReclamoTerritorialScope) {
    return this.request('reclamos.metrics.summary', { ...query, ...scope });
  }

  async findOne(id: string, scope: ReclamoTerritorialScope = {}) {
    const response = await this.request<unknown>('reclamos.find-one', {
      id,
      ...scope,
    });
    if (!this.isRecord(response)) return response;

    const metadata = this.isRecord(response.metadata) ? response.metadata : {};
    const storedEvidence = Array.isArray(metadata.evidencias)
      ? metadata.evidencias.filter((item): item is StoredEvidence =>
          this.isStoredEvidence(item),
        )
      : [];
    const evidencias = await Promise.all(
      storedEvidence.map(async ({ objectKey: _objectKey, ...item }) => ({
        ...item,
        url: await this.evidenceStorage.createDownloadUrl({
          ...item,
          objectKey: _objectKey,
        }),
      })),
    );

    return {
      ...this.sanitizeEvidenceMetadata(response),
      evidencias,
      evidenciasCount: storedEvidence.length,
    };
  }

  async createPublic(
    payload: PublicClaimSubmissionDto,
    clientIp: string,
    evidenceFiles: EvidenceUploadFile[] = [],
  ) {
    await this.checkIpRateLimit('public-claims', clientIp, 5, 3600);

    const municipality = await this.resolvePublicMunicipality();
    const municipalityId = municipality.id;
    const municipalityName = municipality.defaultCity || municipality.name;
    const category = municipality.categories?.find(
      (item) => item.code === payload.categoria && item.isActive === true &&
        PUBLIC_CLAIM_CATEGORIES.includes(item.code),
    );
    if (!category) {
      throw new BadRequestException('La categoria no esta habilitada para este municipio.');
    }

    const correlationId = randomUUID();
    const geocoding = await this.request<{
      status: string;
      data?: {
        lat: number;
        lng: number;
        formattedAddress?: string;
        addressComponents?: {
          locality?: string | null;
          country?: string | null;
          adminArea?: string | null;
        };
      };
    }>('geo.geocode-address', {
      correlationId,
      address: payload.direccion.trim(),
      city: municipalityName,
      country: municipality.country,
    });

    if (geocoding.status === 'geocode_unavailable') {
      throw new HttpException(
        'La geolocalizacion no esta disponible temporalmente.',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    if (geocoding.status !== 'geocode_ok' || !geocoding.data) {
      throw new BadRequestException(
        'No pudimos validar la direccion ingresada.',
      );
    }

    const locality = this.normalizeLocation(
      geocoding.data.addressComponents?.locality ?? '',
    );
    const country = this.normalizeLocation(geocoding.data.addressComponents?.country ?? '');
    const adminArea = this.normalizeLocation(geocoding.data.addressComponents?.adminArea ?? '');
    const allowedCountries = municipality.allowedCountries?.length
      ? municipality.allowedCountries
      : [municipality.country];
    if (
      !locality ||
      locality !== this.normalizeLocation(municipalityName) ||
      !allowedCountries.some((item) => this.normalizeLocation(item) === country) ||
      (municipality.allowedAdminAreas?.length &&
        !municipality.allowedAdminAreas.some((item) =>
          [locality, adminArea].includes(this.normalizeLocation(item)),
        )) ||
      !Number.isFinite(geocoding.data.lat) ||
      !Number.isFinite(geocoding.data.lng) ||
      Math.abs(geocoding.data.lat) > 90 ||
      Math.abs(geocoding.data.lng) > 180 ||
      (geocoding.data.lat === 0 && geocoding.data.lng === 0)
    ) {
      throw new BadRequestException(
        'La direccion no pertenece a la localidad habilitada.',
      );
    }

    const contacto = payload.contacto.trim();
    const isEmail = contacto.includes('@');
    const normalizedContact = isEmail
      ? contacto.toLowerCase()
      : contacto.replace(/\D/g, '');
    const storedEvidence = await this.evidenceStorage.storeEvidence(
      municipalityId,
      correlationId,
      evidenceFiles,
    );
    let claim: {
      trackingCode?: string;
      codigoSeguimiento?: string;
      createdAt?: string;
    };
    try {
      claim = await this.request('reclamos.create', {
        correlationId,
        contactKey: `web:${isEmail ? 'email' : 'phone'}:${normalizedContact}`,
        canal: 'web',
        correo: isEmail ? normalizedContact : undefined,
        problema: payload.problema.trim(),
        direccion: geocoding.data.formattedAddress || payload.direccion.trim(),
        lat: geocoding.data.lat,
        lng: geocoding.data.lng,
        categoria: payload.categoria,
        prioridad: category.defaultPriority || 'media',
        municipalityId,
        metadata: {
          source: 'public-web',
          geocodingProvider: 'google-geocoding',
          ...(storedEvidence.length > 0 ? { evidencias: storedEvidence } : {}),
        },
      });
    } catch (error: unknown) {
      await this.evidenceStorage.deleteEvidence(storedEvidence);
      throw error;
    }

    const trackingCode = claim.trackingCode || claim.codigoSeguimiento;
    if (!trackingCode) {
      await this.evidenceStorage.deleteEvidence(storedEvidence);
      throw new BadGatewayException(
        'El reclamo fue enviado, pero no se recibio su codigo de seguimiento.',
      );
    }

    return {
      status: 'created',
      trackingCode,
      createdAt: claim.createdAt,
      message: 'Reclamo registrado. Guarda tu codigo de seguimiento.',
    };
  }

  async getPublicTracking(payload: PublicTrackingDto, clientIp: string) {
    await this.checkIpRateLimit('public-tracking', clientIp, 10, 900);
    return this.request('reclamos.public-tracking', payload);
  }

  async getPublicConfiguration() {
    const municipality = await this.resolvePublicMunicipality();
    return {
      municipality: {
        id: municipality.id,
        name: municipality.name,
        city: municipality.defaultCity || municipality.name,
      },
      categories: (municipality.categories ?? [])
        .filter((item) => item.isActive === true && PUBLIC_CLAIM_CATEGORIES.includes(item.code))
        .map((item) => ({ code: item.code, name: item.name })),
    };
  }

  private async resolvePublicMunicipality(): Promise<MunicipalityConfigurationDto> {
    const id = process.env.PUBLIC_MUNICIPALITY_ID?.trim();
    if (id && /^[a-z0-9]+(?:_[a-z0-9]+)*$/.test(id)) {
      try {
        const municipality = await this.request<MunicipalityConfigurationDto>(
          'municipalities.config.get',
          { data: { id }, context: { userId: 'public-web', ip: '' } },
        );
        if (municipality?.id === id && municipality.isActive === true) {
          return municipality;
        }
      } catch {
        this.logger.warn('No se pudo obtener la configuracion municipal del canal web');
      }
    }
    throw new HttpException(
      'El municipio del canal web no esta disponible.',
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }

  private async checkIpRateLimit(
    purpose: string,
    clientIp: string,
    maxRequests: number,
    windowSeconds: number,
  ): Promise<void> {
    const clientHash = createHash('sha256').update(clientIp).digest('hex');
    const key = `smartservice:${purpose}:ratelimit:${clientHash}`;

    try {
      const redis = this.redisService.getClient();
      const count = await redis.incr(key);
      if (count === 1) {
        await redis.expire(key, windowSeconds);
      }
      if (count > maxRequests) {
        throw new HttpException(
          'Se alcanzo el limite de solicitudes. Intenta nuevamente mas tarde.',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error('No se pudo validar el limite de seguimiento publico');
      throw new HttpException(
        'El servicio no esta disponible temporalmente.',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  private normalizeLocation(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLocaleLowerCase('es-AR');
  }

  private sanitizeEvidenceMetadata<T extends Record<string, unknown>>(claim: T) {
    const metadata = this.isRecord(claim.metadata) ? { ...claim.metadata } : {};
    const evidenceCount = Array.isArray(metadata.evidencias)
      ? metadata.evidencias.length
      : 0;
    delete metadata.evidencias;
    return { ...claim, metadata, evidenciasCount: evidenceCount };
  }

  private isStoredEvidence(value: unknown): value is StoredEvidence {
    return (
      this.isRecord(value) &&
      typeof value.objectKey === 'string' &&
      typeof value.nombreArchivo === 'string' &&
      typeof value.contentType === 'string' &&
      typeof value.size === 'number' &&
      typeof value.uploadedAt === 'string'
    );
  }

  getHistory(id: string, scope: ReclamoTerritorialScope = {}) {
    return this.request('reclamos.history', { id, ...scope });
  }

  reviewResolution(
    payload: ReviewResolutionDto,
    scope: ReclamoTerritorialScope = {},
  ) {
    return this.request('reclamos.resolution.review', { ...payload, ...scope });
  }

  requestNewVisit(
    payload: RequestNewVisitDto,
    scope: ReclamoTerritorialScope = {},
  ) {
    return this.request('reclamos.new-visit.request', { ...payload, ...scope });
  }

  close(payload: CloseReclamoDto, scope: ReclamoTerritorialScope = {}) {
    return this.request('reclamos.close', { ...payload, ...scope });
  }

  update(
    id: string,
    data: UpdateReclamoDto,
    scope: ReclamoTerritorialScope = {},
  ) {
    return this.request('reclamos.update', { id, data, ...scope });
  }

  remove(id: string, scope: ReclamoTerritorialScope = {}) {
    return this.request('reclamos.remove', { id, ...scope });
  }

  private async request<T = unknown>(
    pattern: string,
    payload: unknown,
  ): Promise<T> {
    try {
      return await firstValueFrom(
        this.natsClient.send<T>(pattern, payload).pipe(timeout(10000)),
      );
    } catch (error: unknown) {
      this.logger.error(
        `Error RPC en patron ${pattern}: ${this.stringifyError(error)}`,
      );
      throw this.mapRpcError(error);
    }
  }

  private mapRpcError(error: unknown): HttpException {
    if (error instanceof HttpException) {
      return error;
    }

    if (this.isRecord(error)) {
      const statusCode = this.extractStatusCode(error);
      const message = this.extractMessage(error);

      if (statusCode) {
        return new HttpException(message, statusCode);
      }

      if (message.toLowerCase().includes('no se encontr')) {
        return new HttpException(message, HttpStatus.NOT_FOUND);
      }

      return new BadGatewayException(message);
    }

    if (error instanceof Error) {
      if (error.message.toLowerCase().includes('no se encontr')) {
        return new HttpException(error.message, HttpStatus.NOT_FOUND);
      }

      return new BadGatewayException(error.message);
    }

    return new BadGatewayException(
      'Error inesperado al comunicarse con ms-reclamos',
    );
  }

  private extractStatusCode(
    error: Record<string, unknown>,
  ): number | undefined {
    const direct = error.statusCode;
    if (typeof direct === 'number') {
      return direct;
    }

    const nested = this.isRecord(error.error)
      ? error.error.statusCode
      : undefined;
    if (typeof nested === 'number') {
      return nested;
    }

    return undefined;
  }

  private extractMessage(error: Record<string, unknown>): string {
    const candidates = [
      error.message,
      this.isRecord(error.error) ? error.error.message : undefined,
      this.isRecord(error.response) ? error.response.message : undefined,
    ];

    for (const candidate of candidates) {
      if (typeof candidate === 'string' && candidate.trim()) {
        return candidate;
      }

      if (Array.isArray(candidate) && candidate.length > 0) {
        return candidate.map(String).join(', ');
      }
    }

    return 'Error desconocido en ms-reclamos';
  }

  private stringifyError(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    if (this.isRecord(error)) {
      return JSON.stringify(error);
    }

    return String(error);
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
  }
}
