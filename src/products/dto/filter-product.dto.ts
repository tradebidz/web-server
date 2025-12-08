import { IsOptional, IsString } from 'class-validator';

export class FilterProductDto {
    @IsOptional()
    page?: string;

    @IsOptional()
    limit?: string;

    @IsOptional()
    @IsString()
    search?: string;

    @IsOptional()
    category_id?: string;
}