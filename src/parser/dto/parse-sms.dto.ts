import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class ParseSmsDto {
  @ApiProperty({ example: '127' })
  @IsString()
  @IsNotEmpty()
  senderId!: string;

  @ApiProperty({
    example:
      'Dear Customer You have received ETB 1,200.00 from Abebe(2519****0000). Your transaction number is ABC123. Your current E-Money Account balance is ETB 2,000.00.',
  })
  @IsString()
  @IsNotEmpty()
  messageBody!: string;
}
