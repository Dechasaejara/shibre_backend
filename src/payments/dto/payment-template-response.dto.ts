import { ApiProperty } from '@nestjs/swagger';

export class PaymentTemplateFieldResponseDto {
  @ApiProperty({ example: 'merchantId' })
  key!: string;

  @ApiProperty({ example: 'Merchant ID' })
  label!: string;

  @ApiProperty({ example: 'STRING' })
  valueType!: string;

  @ApiProperty({ example: true })
  isRequired!: boolean;

  @ApiProperty({ example: '^\\d{1,20}$', nullable: true })
  validationPattern!: string | null;

  @ApiProperty({ example: 10 })
  sortOrder!: number;
}

export class PaymentTemplateResponseDto {
  @ApiProperty({ example: 'telebirr' })
  providerCode!: string;

  @ApiProperty({ example: 'Telebirr' })
  providerName!: string;

  @ApiProperty({ example: 'MERCHANT_PAY' })
  paymentType!: string;

  @ApiProperty({ example: 1 })
  version!: number;

  @ApiProperty({ example: '*127*1*1*{merchantId}*{amount}#' })
  template!: string;

  @ApiProperty({ type: [PaymentTemplateFieldResponseDto] })
  fields!: PaymentTemplateFieldResponseDto[];
}
