import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../common/decorators/roles.decorator';
import { RequestContext } from '../common/decorators/request-context.decorator';
import type { RequestContextData } from '../common/decorators/request-context.decorator';
import { AuditGatewayService } from './audit.service';
import { GetAuditLogsDto } from './dto/get-audit-logs.dto';

@ApiTags('Audit')
@Controller('audit/logs')
@Roles('ADMIN')
export class AuditController {
  constructor(private readonly auditService: AuditGatewayService) {}

  @Get()
  @ApiOperation({ summary: 'Consulta logs de auditoría; solo ADMIN' })
  getLogs(
    @Query() query: GetAuditLogsDto,
    @RequestContext() context: RequestContextData,
  ) {
    return this.auditService.getLogs(query, context);
  }
}