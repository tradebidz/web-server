import { IsNotEmpty, IsString } from 'class-validator';

export class CreateQuestionDto {
    @IsNotEmpty({ message: 'Content is required' })
    @IsString()
    content: string;
}