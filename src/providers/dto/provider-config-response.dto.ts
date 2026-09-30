import { ApiProperty } from '@nestjs/swagger';

export class ProviderSenderAliasDto {
  @ApiProperty({ example: '127' })
  senderId!: string;

  @ApiProperty({ example: 10 })
  priority!: number;
}

export class ProviderParserFieldMappingDto {
  @ApiProperty({ example: 'amount' })
  captureGroup!: string;

  @ApiProperty({ example: 'amount' })
  targetField!: string;

  @ApiProperty({ example: 'NUMBER' })
  valueType!: string;

  @ApiProperty({ example: true })
  isRequired!: boolean;

  @ApiProperty({ example: 'stripCurrency', nullable: true })
  transform!: string | null;
}

export class ProviderParserRuleExampleDto {
  @ApiProperty({
    example:
      'You have received ETB 500.00 from Abebe Kebede. Your balance is ETB 1,500.00.',
  })
  messageBody!: string;

  @ApiProperty({ example: 'P2P_IN', nullable: true })
  expectedType!: string | null;

  @ApiProperty({ example: '500.00', nullable: true })
  expectedAmount!: string | null;

  @ApiProperty({ example: '1500.00', nullable: true })
  expectedBalance!: string | null;

  @ApiProperty({ example: 'FT123456', nullable: true })
  expectedRef!: string | null;

  @ApiProperty({ example: 'Abebe Kebede', nullable: true })
  expectedCounterpartyName!: string | null;

  @ApiProperty({ example: '+251911111111', nullable: true })
  expectedCounterpartyPhone!: string | null;
}

export class ProviderParserRuleDto {
  @ApiProperty({ example: 'P2P_IN' })
  transactionType!: string;

  @ApiProperty({ example: '(?:received)\\s+ETB\\s+(?<amount>[\\d,.]+)' })
  pattern!: string;

  @ApiProperty({ example: 10 })
  priority!: number;

  @ApiProperty({ type: [ProviderParserFieldMappingDto] })
  fieldMappings!: ProviderParserFieldMappingDto[];

  @ApiProperty({ type: [ProviderParserRuleExampleDto] })
  examples!: ProviderParserRuleExampleDto[];
}

export class ProviderPaymentTemplateFieldDto {
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

export class ProviderPaymentTemplateDto {
  @ApiProperty({ example: 'MERCHANT_PAY' })
  paymentType!: string;

  @ApiProperty({ example: '*127*1*1*{merchantId}*{amount}#' })
  template!: string;

  @ApiProperty({ example: 'Choose 8 My Account, then 1 Balance.', nullable: true, type: String })
  instructions!: string | null;

  @ApiProperty({ example: 1 })
  version!: number;

  @ApiProperty({ type: [ProviderPaymentTemplateFieldDto] })
  fields!: ProviderPaymentTemplateFieldDto[];
}

export class ProviderConfigProviderDto {
  @ApiProperty({ example: 'telebirr' })
  code!: string;

  @ApiProperty({ example: 'Telebirr' })
  displayName!: string;

  @ApiProperty({ example: 'ET' })
  countryCode!: string;

  @ApiProperty({ example: 'ETB' })
  currency!: string;

  @ApiProperty({ example: 1 })
  version!: number;

  @ApiProperty({ type: [ProviderSenderAliasDto] })
  senderAliases!: ProviderSenderAliasDto[];

  @ApiProperty({ type: [ProviderParserRuleDto] })
  parserRules!: ProviderParserRuleDto[];

  @ApiProperty({ type: [ProviderPaymentTemplateDto] })
  paymentTemplates!: ProviderPaymentTemplateDto[];
}

export class ProviderConfigResponseDto {
  @ApiProperty({ example: '2026-09-25T12:00:00.000Z' })
  generatedAt!: string;

  @ApiProperty({ type: [ProviderConfigProviderDto] })
  providers!: ProviderConfigProviderDto[];
}
