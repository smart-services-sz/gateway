import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { AUTH_COOKIES } from './constants/auth-cookies';
import { clearAuthCookies, setAuthCookies } from './utils/set-auth-cookies';
import { Public } from './decorators/public.decorator';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { RequestContext, type RequestContextData } from '../common/decorators/request-context.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { PaginationDto } from '../common/dto/pagination.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('me')
  me(@Req() req: any) {
    return req.user;
  }

  @Public()
  @Post('login')
  async login(
    @Body() dto: { email: string; password: string },
    @Res({ passthrough: true }) res: Response,
    @RequestContext() context: RequestContextData,
  ) {
    const { accessToken, refreshToken, user } =
      await this.authService.login(dto, context);

    setAuthCookies(res, accessToken, refreshToken);

    return {
      user,
      access_token: accessToken,
      refresh_token: refreshToken,
    };
  }

  @Public()
  @Post('register')
  async register(
    @Body() dto: { email: string; password: string },
    @RequestContext() context: RequestContextData,
  ) {
    return this.authService.register(dto, context);
  }

  @Public()
  @Post('refresh')
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @RequestContext() context: RequestContextData,
  ) {
    const refreshToken = req.cookies?.[AUTH_COOKIES.refresh];

    const { accessToken, refreshToken: newRefreshToken } =
      await this.authService.refresh(refreshToken, context);

    setAuthCookies(res, accessToken, newRefreshToken);

    return { access_token: accessToken };
  }

  @Public()
  @Post('logout')
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @RequestContext() context: RequestContextData,
  ) {
    const refreshToken = req.cookies?.[AUTH_COOKIES.refresh];

    await this.authService.logout(refreshToken, context);

    clearAuthCookies(res);

    return { success: true };
  }

  @Roles('ADMIN')
  @Permissions('VIEW_USERS')
  @Get('users')
  async getAllUsers(
    @Query() pagination: PaginationDto,
    @RequestContext() context: RequestContextData,
  ) {
    return this.authService.getAllUsers(pagination, context);
  }

  @Roles('ADMIN')
  @Permissions('VIEW_DETAIL_USER')
  @Get('users/:id')
  async getUserById(
    @Param('id') id: string,
    @RequestContext() context: RequestContextData,
  ) {
    return this.authService.getUserById(id, context);
  }

  @Roles('ADMIN')
  @Permissions('TOGGLE_STATUS_USER')
  @Patch('users/toggle-status/:id')
  async toggleStatus(
    @Param('id') id: string,
    @RequestContext() context: RequestContextData,
  ) {
    return this.authService.toggleStatus(id, context);
  }

  @Roles('ADMIN')
  @Permissions('CREATE_USER')
  @Post('users')
  async createUser(
    @Body() dto: CreateUserDto,
    @RequestContext() context: RequestContextData,
  ) {
    return this.authService.createUser(dto, context);
  }

  @Roles('ADMIN')
  @Permissions('UPDATE_USER')
  @Patch('users/:id')
  async updateUser(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @RequestContext() context: RequestContextData,
  ) {
    return this.authService.updateUser(id, dto, context);
  }

  @Roles('ADMIN')
  @Permissions('DELETE_USER')
  @Delete('users/:id')
  async deleteUser(
    @Param('id') id: string,
    @RequestContext() context: RequestContextData,
  ) {
    return this.authService.deleteUser(id, context);
  }
}
