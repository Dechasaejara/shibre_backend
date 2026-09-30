import { Module } from '@nestjs/common';
import { ParserController } from './parser.controller';
import { ParserService } from './parser.service';

@Module({
  controllers: [ParserController],
  exports: [ParserService],
  providers: [ParserService],
})
export class ParserModule {}
