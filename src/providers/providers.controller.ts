import { Controller, Get, Param } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { ProviderConfigResponseDto } from './dto/provider-config-response.dto';
import { ProviderSummaryResponseDto } from './dto/provider-summary-response.dto';
import { ProvidersService } from './providers.service';

@ApiTags('Providers')
@Controller('providers')
export class ProvidersController {
  constructor(private readonly providersService: ProvidersService) {}

  @Get()
  @ApiOkResponse({ type: [ProviderSummaryResponseDto] })
  listProviders(): Promise<ProviderSummaryResponseDto[]> {
    return this.providersService.listProviders();
  }

  @Get('config/latest')
  @ApiOkResponse({ type: ProviderConfigResponseDto })
  getLatestProviderConfig(): Promise<ProviderConfigResponseDto> {
    return this.providersService.getLatestProviderConfig();
  }

  @Get(':code')
  @ApiOkResponse({ type: ProviderSummaryResponseDto })
  getProviderByCode(
    @Param('code') code: string,
  ): Promise<ProviderSummaryResponseDto> {
    return this.providersService.getProviderByCode(code);
  }
}
