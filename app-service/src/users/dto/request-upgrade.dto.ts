import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class RequestUpgradeDto {
    @IsNotEmpty({ message: 'Reason is required' })
    @IsString()
    @MinLength(10, { message: 'Reason must be at least 10 characters' })
    reason: string;
}