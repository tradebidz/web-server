import { IsNotEmpty, IsInt, IsString } from 'class-validator';

export class BanBidderDto {
    @IsNotEmpty()
    @IsInt()
    bidderId: number;

    @IsNotEmpty()
    @IsString()
    reason: string;
}