import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AccessTokenGuard } from '../auth/access-token.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.service';
import { SyncPullQueryDto } from './dto/sync-pull-query.dto';
import { SyncPushDto } from './dto/sync-push.dto';
import {
  SyncPullResponseDto,
  SyncPushResponseDto,
  SyncStatusResponseDto,
} from './dto/sync-response.dto';
import { SyncService } from './sync.service';

@ApiTags('Sync')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
@Controller('sync')
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  @Post('push')
  @ApiCreatedResponse({ type: SyncPushResponseDto })
  push(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SyncPushDto,
  ): Promise<SyncPushResponseDto> {
    return this.syncService.push(user, dto);
  }

  @Get('pull')
  @ApiOkResponse({ type: SyncPullResponseDto })
  pull(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: SyncPullQueryDto,
  ): Promise<SyncPullResponseDto> {
    return this.syncService.pull(user, query);
  }

  @Get('status')
  @ApiOkResponse({ type: SyncStatusResponseDto })
  status(): SyncStatusResponseDto {
    return this.syncService.status();
  }
}
