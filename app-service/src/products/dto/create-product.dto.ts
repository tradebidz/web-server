import { IsArray, IsDateString, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateProductDto {
    @IsNotEmpty()
    @IsString()
    name: string;

    @IsNotEmpty()
    @IsString()
    description: string;

    @IsNotEmpty()
    @IsNumber()
    @Min(0)
    category_id: number;

    @IsNotEmpty()
    @IsNumber()
    @Min(1000)
    start_price: number;

    @IsNotEmpty()
    @IsNumber()
    @Min(100)
    step_price: number;

    @IsOptional()
    @IsNumber()
    buy_now_price?: number;

    @IsNotEmpty()
    @IsDateString()
    end_time: string;
    @IsArray()
    @IsString({ each: true })
    images: string[];
}