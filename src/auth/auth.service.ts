import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { catchError, firstValueFrom } from 'rxjs';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { RequestContextData } from '../common/decorators/request-context.decorator';
import { PaginationDto } from '../common/dto/pagination.dto';


@Injectable()
export class AuthService {
  constructor(
    @Inject('NATS_CLIENT') private readonly authClient: ClientProxy,
  ) {}

  /* ============================= */
  /* AUTH                          */
  /* ============================= */

  async login(
    dto: { email: string; password: string },
    context: RequestContextData,
  ) {
    try {
      return await firstValueFrom(
        this.authClient.send('auth.login', {
          data: dto,
          context,
        }),
      );
    } catch {
      throw new UnauthorizedException('Credenciales inválidas');
    }
  }

  async register(
    dto: { email: string; password: string },
    context: RequestContextData,
  ) {
    return await firstValueFrom(
      this.authClient.send('auth.register', {
        data: dto,
        context,
      }),
    );
  }

  async refresh(
    refreshToken: string,
    context: RequestContextData,
  ) {
    try {
      return await firstValueFrom(
        this.authClient.send('auth.refresh', {
          data: { refreshToken },
          context,
        }),
      );
    } catch {
      throw new UnauthorizedException('Refresh inválido o vencido');
    }
  }

  async logout(
    refreshToken: string,
    context: RequestContextData,
  ) {
    try {
      return await firstValueFrom(
        this.authClient.send('auth.logout', {
          data: { refreshToken },
          context,
        }),
      );
    } catch {
      return { success: true };
    }
  }

  /* ============================= */
  /* USERS                         */
  /* ============================= */

  async getAllUsers(
    pagination: PaginationDto,
    context: RequestContextData,
  ) {
    return await firstValueFrom(
      this.authClient
        .send('users.get.all', {
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

  async getUserById(
    id: string,
    context: RequestContextData,
  ) {
    return await firstValueFrom(
      this.authClient
        .send('users.get.id', {
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

  async toggleStatus(
    id: string,
    context: RequestContextData,
  ) {
    return await firstValueFrom(
      this.authClient
        .send('users.toggle.status', {
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

  async createUser(
    dto: CreateUserDto,
    context: RequestContextData,
  ) {
    return await firstValueFrom(
      this.authClient
        .send('users.create', {
          data: dto,
          context,
        })
        .pipe(
          catchError((error) => {
            throw error;
          }),
        ),
    );
  }

  async updateUser(
    id: string,
    dto: UpdateUserDto,
    context: RequestContextData,
  ) {
    return await firstValueFrom(
      this.authClient
        .send('users.update', {
          data: { id, dto },
          context,
        })
        .pipe(
          catchError((error) => {
            throw error;
          }),
        ),
    );
  }
}