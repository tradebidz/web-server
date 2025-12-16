import { IsNotEmpty, IsString } from 'class-validator';

export class AppendDescriptionDto {
    @IsNotEmpty()
    @IsString()
    content: string;
}