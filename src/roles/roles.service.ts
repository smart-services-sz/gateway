import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { catchError, firstValueFrom, timeout } from 'rxjs';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { RequestContextData } from '../common/decorators/request-context.decorator';
import { JwtUser } from '../common/decorators/current-user.dto';

@Injectable()
export class RolesService {
    constructor(
        @Inject('NATS_CLIENT')
        private readonly natsClient: ClientProxy,
    ){}

    async getAllRoles(
        pagination: PaginationDto,
        context: RequestContextData
    ){
        return await firstValueFrom(
            this.natsClient.send('roles.all', {
                data: pagination,
                context,
            }).pipe(
                catchError((error) => {
                    throw error;
                }),
            ),
        );
    }

    async getRoleById(
        id: string,
        context: RequestContextData,
    ){
        return await firstValueFrom(
            this.natsClient.send('roles.id', {
                data: { id },
                context,
            }).pipe(
                catchError((error) => {
                    throw error;
                }),
            ),
        );
    }

    async createRole(
        dto: CreateRoleDto,
        user: JwtUser,
        context: RequestContextData,
    ){
        return await firstValueFrom(
            this.natsClient.send('roles.create', {
                data: {
                    dto,
                    user,
                },
                context,
            }).pipe(
                catchError((error) => {
                    throw error;
                }),
            ),
        );
    }

    async updateRole(
        id: string,
        dto: UpdateRoleDto,
        user: JwtUser,
        context: RequestContextData
    ){
        return await firstValueFrom(
            this.natsClient.send('roles.update', {
                data: {
                    id,
                    dto,
                    user,
                },
                context,
            }).pipe(
                catchError((error) => {
                    throw error;
                }),
            ),
        );
    }

    async getUserRoles(
        userId: string,
        context: RequestContextData,
    ){
        return firstValueFrom(
            this.natsClient.send('user.roles.get', { 
                data: { userId }, context 
            }).pipe(
                timeout(8000)
            ),
        );
    }

    async setUserRoles(
    dto: { userId: string; rolesIds: string[] },
    user: JwtUser,
    context: RequestContextData,
    ) {
        return firstValueFrom(
            this.natsClient
            .send('user.roles.set', {
                data: { dto, user },
                context,
            })
            .pipe(timeout(8000)),
        );
    }
}
