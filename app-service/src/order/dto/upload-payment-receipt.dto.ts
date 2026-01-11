import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class UploadPaymentReceiptDto {
  @ApiProperty({
    description: 'URL of the uploaded payment receipt image',
    example: 'https://example.com/receipt.jpg',
  })
  @IsString()
  @IsNotEmpty()
  paymentReceiptUrl: string;

  @ApiProperty({
    description: 'Shipping address for product delivery',
    example: '123 Nguyen Trai Street, District 1, Ho Chi Minh City',
  })
  @IsString()
  @IsNotEmpty()
  shippingAddress: string;
}
