import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsOptional, ValidateNested } from 'class-validator';
import { CreateManualTransactionDto } from '../../transactions/dto/create-manual-transaction.dto';
import { IngestRawSmsDto } from '../../transactions/dto/ingest-raw-sms.dto';
import { IngestSmsTransactionDto } from '../../transactions/dto/ingest-sms-transaction.dto';

export class SyncPushDto {
  @ApiProperty({ type: [CreateManualTransactionDto], required: false })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateManualTransactionDto)
  manualTransactions?: CreateManualTransactionDto[];

  @ApiProperty({ type: [IngestSmsTransactionDto], required: false })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => IngestSmsTransactionDto)
  smsTransactions?: IngestSmsTransactionDto[];

  @ApiProperty({ type: [IngestRawSmsDto], required: false })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => IngestRawSmsDto)
  rawSmsMessages?: IngestRawSmsDto[];
}
