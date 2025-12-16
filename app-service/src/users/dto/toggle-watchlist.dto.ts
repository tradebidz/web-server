import { IsInt, IsNotEmpty } from 'class-validator';
import { Type } from 'class-transformer';

export class ToggleWatchlistDto {
    @IsNotEmpty()
    @IsInt()
    @Type(() => Number)
    productId: number;
}