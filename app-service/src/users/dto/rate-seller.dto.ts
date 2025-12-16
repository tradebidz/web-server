import { IsIn, IsInt, IsNotEmpty, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class RateSellerDto {
    @IsNotEmpty()
    @IsInt()
    @Type(() => Number)
    productId: number;

    @IsNotEmpty()
    @IsInt()
    @IsIn([1, -1], { message: 'Score must be 1 or -1' })
    score: number;

    @IsNotEmpty()
    @IsString()
    comment: string;
}