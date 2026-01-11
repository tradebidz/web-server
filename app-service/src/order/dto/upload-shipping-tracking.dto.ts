import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class UploadShippingTrackingDto {
  @ApiProperty({
    description: 'Shipping tracking code',
    example: 'VN123456789',
  })
  @IsString()
  @IsNotEmpty()
  trackingCode: string;

  @ApiProperty({
    description: 'Shipping company name',
    example: 'Viettel Post',
    required: false,
  })
  @IsString()
  @IsOptional()
  company?: string;

  @ApiProperty({
    description: 'URL of the uploaded shipping tracking document image',
    example: 'https://example.com/tracking.jpg',
    required: false,
  })
  @IsString()
  @IsOptional()
  trackingUrl?: string;
}
