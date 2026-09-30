import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsObject, IsString } from 'class-validator';

export class RenderPaymentTemplateDto {
  @ApiProperty({ example: 'telebirr' })
  @IsString()
  @IsNotEmpty()
  providerCode!: string;

  @ApiProperty({ example: 'MERCHANT_PAY' })
  @IsString()
  @IsNotEmpty()
  paymentType!: string;

  @ApiProperty({ example: { merchantId: '123456', amount: '250.00' } })
  @IsObject()
  fields!: Record<string, string>;
}

export class RenderPaymentTemplateResponseDto {
  @ApiProperty({ example: 'telebirr' })
  providerCode!: string;

  @ApiProperty({ example: 'Telebirr' })
  providerName!: string;

  @ApiProperty({ example: 'MERCHANT_PAY' })
  paymentType!: string;

  @ApiProperty({ example: 1 })
  version!: number;

  @ApiProperty({ example: '*127*1*1*123456*250.00#' })
  dialString!: string;

  @ApiProperty({ example: 'tel:*127*1*1*123456*250.00%23' })
  telUri!: string;
}
