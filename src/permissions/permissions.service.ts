import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { catchError, firstValueFrom, timeout } from 'rxjs';
import { CreatePermissionDto } from './dto/create-permission.dto';
import { UpdatePermissionDto } from './dto/update-permission.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { RequestContextData } from '../common/decorators/request-context.decorator';
import { JwtUser } from '../common/decorators/current-user.dto';

@Injectable()
export class PermissionsService {
  constructor(
    @Inject('NATS_CLIENT')
    private readonly natsClient: ClientProxy,
  ) {}

  async getAllPermissions(
    pagination: PaginationDto,
    context: RequestContextData,
  ) {
    return await firstValueFrom(
      this.natsClient
        .send('permissions.all', {
          data: pagination,
          context,
        })
        .pipe(
          catchError((error) => {
            throw error;
          }),
        ),
    );
  }

  async getPermissionById(id: string, context: RequestContextData) {
    return await firstValueFrom(
      this.natsClient
        .send('permission.id', {
          data: { id },
          context,
        })
        .pipe(
          catchError((error) => {
            throw error;
          }),
        ),
    );
  }

  async createPermission(
    dto: CreatePermissionDto,
    user: JwtUser,
    context: RequestContextData,
  ) {
    return await firstValueFrom(
      this.natsClient
        .send('permission.create', {
          data: {
            dto,
            user,
          },
          context,
        })
        .pipe(
          catchError((error) => {
            throw error;
          }),
        ),
    );
  }

  async updatePermission(
    id: string,
    dto: UpdatePermissionDto,
    user: JwtUser,
    context: RequestContextData,
  ) {
    return await firstValueFrom(
      this.natsClient
        .send('permission.update', {
          data: {
            id,
            dto,
            user,
          },
          context,
        })
        .pipe(
          catchError((error) => {
            throw error;
          }),
        ),
    );
  }

  async deletePermission(
    id: string,
    user: JwtUser,
    context: RequestContextData,
  ) {
    return await firstValueFrom(
      this.natsClient
        .send('permission.delete', {
          data: {
            id,
            user,
          },
          context,
        })
        .pipe(
          catchError((error) => {
            throw error;
          }),
        ),
    );
  }

  async getUserPermissions(userId: string, context: RequestContextData) {
    return firstValueFrom(
      this.natsClient
        .send('user.permissions.get', {
          data: { userId },
          context,
        })
        .pipe(timeout(8000)),
    );
  }

  async setUserPermissions(
    dto: { userId: string; permissionIds: string[] },
    user: JwtUser,
    context: RequestContextData,
  ) {
    return firstValueFrom(
      this.natsClient
        .send('user.permissions.set', {
          data: { dto, user },
          context,
        })
        .pipe(timeout(8000)),
    );
  }
}
