import { IsArray, IsBoolean, IsDateString, IsNotEmpty, IsNumber, IsOptional, IsString, Min, ArrayMinSize } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateProductDto {
    @ApiProperty({ description: 'Product name', example: 'Vintage Camera' })
    @IsNotEmpty()
    @IsString()
    name: string;

    @ApiProperty({ description: 'Category ID', example: 1 })
    @IsNotEmpty()
    @IsNumber()
    category_id: number;

    @ApiProperty({ description: 'Starting price', example: 100, minimum: 0 })
    @IsNotEmpty()
    @IsNumber()
    @Min(0)
    start_price: number;

    @ApiProperty({ description: 'Minimum bid increment', example: 10 })
    @IsNotEmpty()
    @IsNumber()
    step_price: number;

    @ApiPropertyOptional({ description: 'Buy now price', example: 500 })
    @IsOptional()
    @IsNumber()
    buy_now_price?: number;

    @ApiProperty({ description: 'Product description', example: 'A vintage camera in excellent condition' })
    @IsNotEmpty()
    @IsString()
    description: string;

    @ApiProperty({ description: 'Auction end time', example: '2024-12-31T23:59:59Z' })
    @IsNotEmpty()
    @IsDateString()
    end_time: string;

    @ApiPropertyOptional({ description: 'Auto-extend auction if bid in last 5 minutes', example: true })
    @IsOptional()
    @IsBoolean()
    is_auto_extend?: boolean;

    @ApiProperty({ description: 'Product images (minimum 3)', example: ['image1.jpg', 'image2.jpg', 'image3.jpg'], minItems: 3 })
    @IsArray()
    @ArrayMinSize(3, { message: 'Need at least 3 images' })
    @IsString({ each: true })
    images: string[];
}