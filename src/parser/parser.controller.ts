import { Body, Controller, Post } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { ParseSmsDto } from './dto/parse-sms.dto';
import { ParseSmsResponseDto } from './dto/parse-sms-response.dto';
import { ParserService } from './parser.service';

@ApiTags('Parser')
@Controller('parser')
export class ParserController {
  constructor(private readonly parserService: ParserService) {}

  @Post('sms/preview')
  @ApiOkResponse({ type: ParseSmsResponseDto })
  previewSms(@Body() dto: ParseSmsDto): Promise<ParseSmsResponseDto> {
    return this.parserService.previewSms(dto.senderId, dto.messageBody);
  }
}
