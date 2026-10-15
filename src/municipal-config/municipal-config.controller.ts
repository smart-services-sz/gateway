import { Body, Controller, Get, Param, ParseBoolPipe, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.dto';
import type { JwtUser } from '../common/decorators/current-user.dto';
import { RequestContext } from '../common/decorators/request-context.decorator';
import type { RequestContextData } from '../common/decorators/request-context.decorator';
import { MunicipalConfigService } from './municipal-config.service';
import { MunicipalityConfigurationDto } from './dto/municipality-configuration.dto';

@ApiTags('Municipal Configuration')
@Controller('municipalities/config')
@Roles('ADMIN')
export class MunicipalConfigController {
  constructor(private readonly service: MunicipalConfigService) {}

  @Get()
  @ApiOperation({ summary: 'Lista configuraciones municipales' })
  list(
    @Query('includeInactive', new ParseBoolPipe({ optional: true })) includeInactive = false,
    @RequestContext() context: RequestContextData,
  ) {
    return this.service.list(includeInactive, context);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtiene la configuración de un municipio' })
  get(@Param('id') id: string, @RequestContext() context: RequestContextData) {
    return this.service.get(id, context);
  }

  @Post()
  @ApiOperation({ summary: 'Crea o actualiza el catálogo de un municipio' })
  save(
    @Body() dto: MunicipalityConfigurationDto,
    @CurrentUser() user: JwtUser,
    @RequestContext() context: RequestContextData,
  ) {
    return this.service.save(dto, user, context);
  }
}