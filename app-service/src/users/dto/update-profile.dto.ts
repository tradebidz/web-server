import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateProfileDto {
    @IsOptional()
    @IsEmail({}, { message: 'Email is invalid' })
    email?: string;

    @IsOptional()
    @IsString()
    full_name?: string;

    @IsOptional()
    @IsString()
    address?: string;

    @IsOptional()
    @IsString()
    dob?: string;

    @IsOptional()
    @MinLength(6, { message: 'Password must be at least 6 characters' })
    password?: string;

    @IsOptional()
    @IsString()
    old_password?: string;
}