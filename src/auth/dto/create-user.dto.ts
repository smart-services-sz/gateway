import { IsArray, IsBoolean, IsEmail, IsNotEmpty, IsOptional, IsString, IsStrongPassword, IsUUID } from "class-validator";

export class CreateUserDto {
    
    @IsNotEmpty()
    @IsString()
    name?: string;

    @IsNotEmpty()
    @IsEmail()
    email: string;

    @IsNotEmpty()
    @IsStrongPassword()
    password: string;

    @IsOptional()
    @IsArray()
    @IsUUID('4', { each: true })
    roleIds?: string[];

    @IsBoolean()
    isActive: boolean;

    @IsNotEmpty()
    @IsString()
    cargo: string;

    @IsNotEmpty()
    @IsString()
    legajo: string;

    @IsNotEmpty()
    @IsString()
    area: string;

}