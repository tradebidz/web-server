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
<<<<<<< Updated upstream
=======
import { AdminModule } from './admin/admin.module';
import { NotificationModule } from './notification/notification.module';
>>>>>>> Stashed changes

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    NotificationModule,
    AuthModule,
    UsersModule,
    ProductsModule,
    BiddingModule,
    CategoriesModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
