import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class NotificationService {
    private readonly logger = new Logger(NotificationService.name);
    private readonly redis: Redis;

    constructor(private config: ConfigService) {
        this.redis = new Redis({
            host: this.config.get('REDIS_HOST') || 'localhost',
            port: this.config.get('REDIS_PORT') || 6379,
        });
    }

    async sendBidPlacedEmail(
        productId: number,
        productName: string,
        newPrice: string,
        sellerEmail: string,
        bidderEmail: string,
        prevBidderEmail: string,
    ): Promise<void> {
        try {
            await this.redis.xadd(
                'notification_stream',
                '*',
                'type', 'BID_PLACED',
                'product_id', productId.toString(),
                'product_name', productName,
                'new_price', newPrice,
                'seller_email', sellerEmail,
                'bidder_email', bidderEmail,
                'prev_bidder_email', prevBidderEmail,
            );
            this.logger.log(`BID_PLACED email event sent for product: ${productName}`);
        } catch (error) {
            this.logger.error(`Failed to send BID_PLACED email event: ${error.message}`);
        }
    }

    async sendBidRejectedEmail(
        productName: string,
        bidderEmail: string,
        reason: string,
    ): Promise<void> {
        try {
            await this.redis.xadd(
                'notification_stream',
                '*',
                'type', 'BID_REJECTED',
                'product_name', productName,
                'bidder_email', bidderEmail,
                'reason', reason,
            );
            this.logger.log(`BID_REJECTED email event sent to: ${bidderEmail}`);
        } catch (error) {
            this.logger.error(`Failed to send BID_REJECTED email event: ${error.message}`);
        }
    }

    async sendAuctionSuccessEmail(
        productName: string,
        price: string,
        sellerEmail: string,
        winnerEmail: string,
    ): Promise<void> {
        try {
            await this.redis.xadd(
                'notification_stream',
                '*',
                'type', 'AUCTION_SUCCESS',
                'product_name', productName,
                'price', price,
                'seller_email', sellerEmail,
                'winner_email', winnerEmail,
            );
            this.logger.log(`AUCTION_SUCCESS email event sent for product: ${productName}`);
        } catch (error) {
            this.logger.error(`Failed to send AUCTION_SUCCESS email event: ${error.message}`);
        }
    }

    async sendAuctionFailEmail(
        productName: string,
        sellerEmail: string,
    ): Promise<void> {
        try {
            await this.redis.xadd(
                'notification_stream',
                '*',
                'type', 'AUCTION_FAIL',
                'product_name', productName,
                'seller_email', sellerEmail,
            );
            this.logger.log(`AUCTION_FAIL email event sent for product: ${productName}`);
        } catch (error) {
            this.logger.error(`Failed to send AUCTION_FAIL email event: ${error.message}`);
        }
    }

    async sendNewQuestionEmail(
        productName: string,
        sellerEmail: string,
        question: string,
        productUrl: string,
    ): Promise<void> {
        try {
            await this.redis.xadd(
                'notification_stream',
                '*',
                'type', 'NEW_QUESTION',
                'product_name', productName,
                'seller_email', sellerEmail,
                'question', question,
                'product_url', productUrl,
            );
            this.logger.log(`NEW_QUESTION email event sent to seller: ${sellerEmail}`);
        } catch (error) {
            this.logger.error(`Failed to send NEW_QUESTION email event: ${error.message}`);
        }
    }

    async sendNewAnswerEmail(
        productName: string,
        question: string,
        answer: string,
        emails: string[],
    ): Promise<void> {
        try {
            await this.redis.xadd(
                'notification_stream',
                '*',
                'type', 'NEW_ANSWER',
                'product_name', productName,
                'question', question,
                'answer', answer,
                'emails', JSON.stringify(emails),
            );
            this.logger.log(`NEW_ANSWER email event sent to ${emails.length} bidders`);
        } catch (error) {
            this.logger.error(`Failed to send NEW_ANSWER email event: ${error.message}`);
        }
    }

    async sendDescriptionUpdateEmail(
        productName: string,
        description: string,
        emails: string[],
        productUrl: string,
    ): Promise<void> {
        try {
            await this.redis.xadd(
                'notification_stream',
                '*',
                'type', 'DESCRIPTION_UPDATE',
                'product_name', productName,
                'description', description,
                'emails', JSON.stringify(emails),
                'product_url', productUrl,
            );
            this.logger.log(`DESCRIPTION_UPDATE email event sent to ${emails.length} bidders`);
        } catch (error) {
            this.logger.error(`Failed to send DESCRIPTION_UPDATE email event: ${error.message}`);
        }
    }

    async sendVerifyEmailOtp(email: string, otp: string): Promise<void> {
        try {
            await this.redis.xadd(
                'notification_stream',
                '*',
                'type', 'VERIFY_EMAIL',
                'email', email,
                'otp', otp,
            );
            this.logger.log(`VERIFY_EMAIL email event sent to: ${email}`);
        } catch (error) {
            this.logger.error(`Failed to send VERIFY_EMAIL email event: ${error.message}`);
        }
    }

    async sendResetPasswordOtp(email: string, otp: string): Promise<void> {
        try {
            await this.redis.xadd(
                'notification_stream',
                '*',
                'type', 'RESET_PASSWORD',
                'email', email,
                'otp', otp,
            );
            this.logger.log(`RESET_PASSWORD email event sent to: ${email}`);
        } catch (error) {
            this.logger.error(`Failed to send RESET_PASSWORD email event: ${error.message}`);
        }
    }
}
