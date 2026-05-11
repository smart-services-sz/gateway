import { Body, Controller, Get, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { RolesService } from './roles.service';
import { PaginationDto } from '../common/dto/pagination.dto';
import { RequestContext, type RequestContextData } from '../common/decorators/request-context.decorator';
import { CreateRoleDto } from './dto/create-role.dto';
import { CurrentUser, type JwtUser } from '../common/decorators/current-user.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';

@Controller('roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Roles('ADMIN')
  @Permissions('VIEW_ROLES')
  @Get()
  async getAllRoles(
    @Query() pagination: PaginationDto,
    @RequestContext() context: RequestContextData,
  ) {
    return this.rolesService.getAllRoles(pagination, context);
  }

  @Roles('ADMIN')
  @Permissions('VIEW_ROLES')
  @Get(':id')
  async getRoleById(
    @Param('id') id: string,
    @RequestContext() context: RequestContextData,
  ) {
    return this.rolesService.getRoleById(id, context);
  }

  @Roles('ADMIN')
  @Permissions('MANAGE_ROLES')
  @Post()
  async createRole(
    @Body() dto: CreateRoleDto,
    @CurrentUser() user: JwtUser,
    @RequestContext() context: RequestContextData,
  ) {
    return this.rolesService.createRole(dto, user, context);
  }

  @Roles('ADMIN')
  @Permissions('MANAGE_ROLES')
  @Patch(':id')
  async updateRole(
    @Param('id') id: string,
    @Body() dto: UpdateRoleDto,
    @CurrentUser() user: JwtUser,
    @RequestContext() context: RequestContextData,
  ) {
    return this.rolesService.updateRole(id, dto, user, context);
  }

  @Roles('ADMIN')
  @Permissions('VIEW_ROLES')
  @Get('user/:id')
  getUserRoles(
    @Param('id') id: string,
    @RequestContext() context: RequestContextData,
  ) {
    return this.rolesService.getUserRoles(id, context);
  }

  @Roles('ADMIN')
  @Permissions('MANAGE_ROLES')
  @Put('user/:id')
  setUserRoles(
    @Param('id') id: string,
    @Body() dto: { rolesIds: string[] },
    @CurrentUser() user: JwtUser,
    @RequestContext() context: RequestContextData,
  ) {
    return this.rolesService.setUserRoles(
      { userId: id, rolesIds: dto.rolesIds },
      user,
      context,
    );
  }
}
