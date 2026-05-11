import { Body, Controller, Get, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { PermissionsService } from './permissions.service';
import { CreatePermissionDto } from './dto/create-permission.dto';
import { UpdatePermissionDto } from './dto/update-permission.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { RequestContext, type RequestContextData } from '../common/decorators/request-context.decorator';
import { CurrentUser, type JwtUser } from '../common/decorators/current-user.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';

@Controller('permissions')
export class PermissionsController {
  constructor(private readonly permissionsService: PermissionsService) {}

  @Roles('ADMIN')
  @Permissions('VIEW_PERMISSIONS')
  @Get()
  async getAllPermissions(
    @Query() pagination: PaginationDto,
    @RequestContext() context: RequestContextData,
  ) {
    return this.permissionsService.getAllPermissions(pagination, context);
  }

  @Roles('ADMIN')
  @Permissions('VIEW_PERMISSIONS')
  @Get(':id')
  async getPermissionById(
    @Param('id') id: string,
    @RequestContext() context: RequestContextData,
  ) {
    return this.permissionsService.getPermissionById(id, context);
  }

  @Roles('ADMIN')
  @Permissions('MANAGE_PERMISSIONS')
  @Post()
  async createPermission(
    @Body() dto: CreatePermissionDto,
    @CurrentUser() user: JwtUser,
    @RequestContext() context: RequestContextData,
  ) {
    return this.permissionsService.createPermission(dto, user, context);
  }

  @Roles('ADMIN')
  @Permissions('MANAGE_PERMISSIONS')
  @Patch(':id')
  async updatePermission(
    @Param('id') id: string,
    @Body() dto: UpdatePermissionDto,
    @CurrentUser() user: JwtUser,
    @RequestContext() context: RequestContextData,
  ) {
    return this.permissionsService.updatePermission(id, dto, user, context);
  }

  @Roles('ADMIN')
  @Permissions('VIEW_PERMISSIONS')
  @Get('user/:id')
  getUserPerms(
    @Param('id') id: string,
    @RequestContext() context: RequestContextData,
  ) {
    return this.permissionsService.getUserPermissions(id, context);
  }

  @Roles('ADMIN')
  @Permissions('MANAGE_PERMISSIONS')
  @Put('user/:id')
  setUserPerms(
    @Param('id') id: string,
    @Body() dto: { permissionIds: string[] },
    @CurrentUser() user: JwtUser,
    @RequestContext() context: RequestContextData,
  ) {
    return this.permissionsService.setUserPermissions(
      { userId: id, permissionIds: dto.permissionIds },
      user,
      context,
    );
  }
}
