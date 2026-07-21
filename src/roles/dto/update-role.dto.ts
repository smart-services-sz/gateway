import { IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateRoleDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  name?: string;
}
