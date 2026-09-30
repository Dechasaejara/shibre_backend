import { ApiProperty, PartialType } from '@nestjs/swagger';
import {
  ConfigValueType,
  PaymentTemplateStatus,
  ProviderRuleStatus,
  SubscriptionCategory,
  SubscriptionStatus,
  TransactionType,
  UserRole,
  UserStatus,
  UssdReportStatus,
} from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { CreateSubscriptionDto } from '../../subscriptions/dto/subscription.dto';

export class CreateProviderDto {
  @ApiProperty({ example: 'telebirr' })
  @IsString()
  @MaxLength(80)
  @Matches(/^[a-z0-9_-]+$/i)
  code!: string;

  @ApiProperty({ example: 'Telebirr' })
  @IsString()
  @MaxLength(120)
  displayName!: string;

  @ApiProperty({ example: 'ET', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(2)
  countryCode?: string;

  @ApiProperty({ example: 'ETB', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(3)
  currency?: string;
}

export class UpdateProviderDto extends PartialType(CreateProviderDto) {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CreateParserFieldMappingDto {
  @IsString()
  @MaxLength(100)
  captureGroup!: string;

  @IsString()
  @MaxLength(100)
  targetField!: string;

  @IsOptional()
  @IsEnum(ConfigValueType)
  valueType?: ConfigValueType;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  transform?: string;

  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;
}

export class CreateParserExampleDto {
  @IsString()
  @MaxLength(4000)
  messageBody!: string;

  @IsOptional()
  @IsEnum(TransactionType)
  expectedType?: TransactionType;

  @IsOptional()
  @IsString()
  expectedAmount?: string;

  @IsOptional()
  @IsString()
  expectedBalance?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  expectedRef?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  expectedCounterpartyName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  expectedCounterpartyPhone?: string;
}

export class CreateParserRuleDto {
  @IsInt()
  @Min(1)
  @Max(100000)
  version!: number;

  @IsEnum(TransactionType)
  transactionType!: TransactionType;

  @IsString()
  @MaxLength(4000)
  pattern!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100000)
  priority?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateParserFieldMappingDto)
  fieldMappings?: CreateParserFieldMappingDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateParserExampleDto)
  examples?: CreateParserExampleDto[];
}

export class UpdateParserRuleDto {
  @IsOptional()
  @IsEnum(TransactionType)
  transactionType?: TransactionType;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  pattern?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100000)
  priority?: number;

  @ApiProperty({ required: false, description: 'Replaces all field mappings when provided' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateParserFieldMappingDto)
  fieldMappings?: CreateParserFieldMappingDto[];

  @ApiProperty({ required: false, description: 'Replaces all examples when provided' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateParserExampleDto)
  examples?: CreateParserExampleDto[];
}

export class TestParserPatternDto {
  @IsEnum(TransactionType)
  transactionType!: TransactionType;

  @IsString()
  @MaxLength(4000)
  pattern!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateParserFieldMappingDto)
  fieldMappings!: CreateParserFieldMappingDto[];

  @IsString()
  @MaxLength(4000)
  messageBody!: string;
}

export class TestParserRuleDto {
  @ApiProperty({ required: false, description: 'Omit to run the rule against its saved examples' })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  messageBody?: string;
}

export class CreatePaymentTemplateFieldDto {
  @IsString()
  @MaxLength(80)
  @Matches(/^[A-Za-z][A-Za-z0-9_]*$/)
  key!: string;

  @IsString()
  @MaxLength(100)
  label!: string;

  @IsOptional()
  @IsEnum(ConfigValueType)
  valueType?: ConfigValueType;

  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(256)
  validationPattern?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class CreatePaymentTemplateDto {
  @IsString()
  @MaxLength(80)
  paymentType!: string;

  @IsString()
  @MaxLength(1000)
  template!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  instructions?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreatePaymentTemplateFieldDto)
  fields!: CreatePaymentTemplateFieldDto[];
}

export class UpdateParserRuleStatusDto {
  @ApiProperty({ enum: ProviderRuleStatus })
  @IsEnum(ProviderRuleStatus)
  status!: ProviderRuleStatus;
}

export class UpdatePaymentTemplateStatusDto {
  @ApiProperty({ enum: PaymentTemplateStatus })
  @IsEnum(PaymentTemplateStatus)
  status!: PaymentTemplateStatus;
}

export class ListByStatusQueryDto {
  @ApiProperty({ enum: ProviderRuleStatus, required: false })
  @IsOptional()
  @IsEnum(ProviderRuleStatus)
  status?: ProviderRuleStatus;
}

export class ListUssdReportsQueryDto {
  @ApiProperty({ enum: UssdReportStatus, required: false })
  @IsOptional()
  @IsEnum(UssdReportStatus)
  status?: UssdReportStatus;
}

export class UpdateUssdReportDto {
  @ApiProperty({ enum: UssdReportStatus })
  @IsEnum(UssdReportStatus)
  status!: UssdReportStatus;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  resolutionNote?: string;
}

export class CreateSenderAliasDto {
  @ApiProperty({ example: '127' })
  @IsString()
  @MaxLength(64)
  senderId!: string;

  @ApiProperty({ example: 100, required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100000)
  priority?: number;
}

export class UpdateSenderAliasDto extends PartialType(CreateSenderAliasDto) {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CreatePresetCategoryDto {
  @ApiProperty({ example: 'Groceries' })
  @IsString()
  @MaxLength(80)
  name!: string;

  @ApiProperty({ example: 'cart', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  icon?: string | null;

  @ApiProperty({ example: '#635BFF', required: false })
  @IsOptional()
  @Matches(/^#[0-9A-Fa-f]{6}$/)
  color?: string | null;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  parentId?: string | null;
}

export class UpdatePresetCategoryDto extends PartialType(
  CreatePresetCategoryDto,
) {}

export class ListUsersQueryDto {
  @ApiProperty({ required: false, example: '+2519' })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  search?: string;

  @ApiProperty({ required: false, example: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;
}

export class UpdateUserAccessDto {
  @ApiProperty({ enum: UserRole, required: false })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @ApiProperty({ enum: UserStatus, required: false })
  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;
}

export class UpdatePaymentTemplateDto extends CreatePaymentTemplateDto {}

export class DeleteAdminRecordDto {
  @IsIn(['providers', 'merchants', 'categories', 'aliases', 'parser-rules', 'payment-templates', 'subscriptions'])
  @ApiProperty({ enum: ['providers', 'merchants', 'categories', 'aliases', 'parser-rules', 'payment-templates', 'subscriptions'] })
  resource!: 'providers' | 'merchants' | 'categories' | 'aliases' | 'parser-rules' | 'payment-templates' | 'subscriptions';

  @IsUUID()
  @ApiProperty()
  id!: string;
}

export class DeleteAdminRecordResponseDto {
  @ApiProperty()
  id!: string;
}

export class AdminCreateSubscriptionDto extends CreateSubscriptionDto {
  @ApiProperty({ example: '+251911111111', description: 'Owner of the subscription' })
  @Matches(/^\+251[79]\d{8}$/, { message: 'phoneNumber must be an Ethiopian mobile number in +251 format' })
  phoneNumber!: string;
}

export class ListAdminSubscriptionsQueryDto {
  @ApiProperty({ required: false, description: 'Phone number or subscription name' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  search?: string;

  @ApiProperty({ required: false, enum: SubscriptionStatus })
  @IsOptional()
  @IsEnum(SubscriptionStatus)
  status?: SubscriptionStatus;

  @ApiProperty({ required: false, enum: SubscriptionCategory })
  @IsOptional()
  @IsEnum(SubscriptionCategory)
  category?: SubscriptionCategory;

  @ApiProperty({ required: false, example: 200 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number;
}
