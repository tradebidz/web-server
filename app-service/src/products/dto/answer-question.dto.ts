import { IsNotEmpty, IsString } from 'class-validator';

export class AnswerQuestionDto {
    @IsNotEmpty()
    @IsString()
    answer: string;
}