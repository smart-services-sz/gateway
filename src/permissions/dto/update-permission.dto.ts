import { IsOptional, IsString, MinLength } from 'class-validator';

export class UpdatePermissionDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  name?: string;
}
