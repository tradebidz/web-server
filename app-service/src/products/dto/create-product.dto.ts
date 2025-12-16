import { IsArray, IsBoolean, IsDateString, IsNotEmpty, IsNumber, IsOptional, IsString, Min, ArrayMinSize } from 'class-validator';

export class CreateProductDto {
    @IsNotEmpty()
    @IsString()
    name: string;

    @IsNotEmpty()
    @IsNumber()
    category_id: number;

    @IsNotEmpty()
    @IsNumber()
    @Min(0)
    start_price: number;

    @IsNotEmpty()
    @IsNumber()
    step_price: number;

    @IsOptional()
    @IsNumber()
    buy_now_price?: number;

    @IsNotEmpty()
    @IsString()
    description: string;

    @IsNotEmpty()
    @IsDateString()
    end_time: string;

    @IsOptional()
    @IsBoolean()
    is_auto_extend?: boolean;

    @IsArray()
    @ArrayMinSize(3, { message: 'Need at least 3 images' })
    @IsString({ each: true })
    images: string[];
}