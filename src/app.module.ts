import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AdminModule } from './admin/admin.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AccountsModule } from './accounts/accounts.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { AuthModule } from './auth/auth.module';
import { BalancesModule } from './balances/balances.module';
import { CategoriesModule } from './categories/categories.module';
import { DevicesModule } from './devices/devices.module';
import { validateEnv } from './config/env.validation';
import { HealthModule } from './health/health.module';
import { MerchantsModule } from './merchants/merchants.module';
import { NotificationsModule } from './notifications/notifications.module';
import { ParserModule } from './parser/parser.module';
import { PaymentsModule } from './payments/payments.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProvidersModule } from './providers/providers.module';
import { ReconciliationModule } from './reconciliation/reconciliation.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
import { SyncModule } from './sync/sync.module';
import { TransactionsModule } from './transactions/transactions.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
    AdminModule,
    PrismaModule,
    AccountsModule,
    AnalyticsModule,
    AuthModule,
    BalancesModule,
    CategoriesModule,
    DevicesModule,
    HealthModule,
    MerchantsModule,
    NotificationsModule,
    ParserModule,
    PaymentsModule,
    ProvidersModule,
    ReconciliationModule,
    SubscriptionsModule,
    SyncModule,
    TransactionsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
