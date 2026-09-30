import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AccessTokenGuard } from '../auth/access-token.guard';
import { BusinessOpsGuard } from '../auth/business-ops.guard';
import type { AuthenticatedUser } from '../auth/auth.service';
import { CurrentUser } from '../auth/current-user.decorator';
import { CreateMerchantDto, UpdateMerchantDto } from './dto/merchant.dto';
import { MerchantResponseDto } from './dto/merchant-response.dto';
import { MerchantsService } from './merchants.service';

@ApiTags('Merchants')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
@Controller('merchants')
export class MerchantsController {
  constructor(private readonly merchantsService: MerchantsService) {}

  @Get()
  @ApiOkResponse({ type: [MerchantResponseDto] })
  listMerchants(
    @Query('providerCode') providerCode?: string,
    @Query('search') search?: string,
  ): Promise<MerchantResponseDto[]> {
    return this.merchantsService.listMerchants({ providerCode, search });
  }

  @Post()
  @UseGuards(BusinessOpsGuard)
  @ApiCreatedResponse({ type: MerchantResponseDto })
  createMerchant(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateMerchantDto,
  ): Promise<MerchantResponseDto> {
    return this.merchantsService.createMerchant(user, dto);
  }

  @Patch(':id')
  @UseGuards(BusinessOpsGuard)
  @ApiOkResponse({ type: MerchantResponseDto })
  updateMerchant(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateMerchantDto,
  ): Promise<MerchantResponseDto> {
    return this.merchantsService.updateMerchant(user, id, dto);
  }
}
