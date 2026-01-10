import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';
import { ProductsModule } from './products/products.module';
import { BiddingModule } from './bidding/bidding.module';
import { CategoriesModule } from './categories/categories.module';
import { AdminModule } from './admin/admin.module';
import { NotificationModule } from './notification/notification.module';
import { PaymentModule } from './payment/payment.module';
import { OrderModule } from './order/order.module';
import { WinstonModule, utilities as nestWinstonModuleUtilities } from 'nest-winston';
import * as winston from 'winston';
import { ElasticsearchTransport } from 'winston-elasticsearch';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    WinstonModule.forRoot({
      transports: [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.ms(),
            nestWinstonModuleUtilities.format.nestLike('TradeBidz', {
              prettyPrint: true,
            }),
          ),
        }),
        new ElasticsearchTransport({
          level: 'info',
          clientOpts: {
            node: process.env.ELASTICSEARCH_NODE || 'http://localhost:9200',
          },
          transformer: (logData) => {
            const transformed = {
              '@timestamp': new Date().toISOString(),
              severity: logData.level,
              service: 'app-service',
              message: logData.message,
              meta: logData.meta,
            };
            return transformed;
          },
        }),
      ],
    }),
    PrismaModule,
    NotificationModule,
    AuthModule,
    AdminModule,
    UsersModule,
    ProductsModule,
    BiddingModule,
    CategoriesModule,
    PaymentModule,
    OrderModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
