import { Logger, Module } from '@nestjs/common';
import {
    WebSocketGateway,
    WebSocketServer,
    OnGatewayInit,
    OnGatewayConnection,
    OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server } from 'socket.io';
import Redis from 'ioredis';
import { ConfigService } from '@nestjs/config';

@WebSocketGateway({
    cors: {
        origin: '*',
    },
    namespace: 'auctions'
})

export class BiddingGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer() server: Server;
    private logger: Logger = new Logger("BiddingGateway");
    private redisSubcriber: Redis;

    constructor(private configService: ConfigService) {
        this.redisSubcriber = new Redis({
            host: this.configService.get('REDIS_HOST') || 'localhost',
            port: this.configService.get('REDIS_PORT') || 6379,
        });
    }

    afterInit(server: Server) {
        this.logger.log('BiddingGateway initialized');

        this.redisSubcriber.subscribe('auction_updates', (err) => {
            if (err) this.logger.error('Failed to subcribe to Redis channel');
            else this.logger.log('Subscribed to Redis channel: auction_updates');
        });

        this.redisSubcriber.on('message', (channel, message) => {
            if (channel === 'auction_updates') {
                this.handleAuctionUpdate(message);
            }
        });
    }

    handleAuctionUpdate(message: string) {
        try {
            const data = JSON.parse(message);
            this.logger.log(`Received bid update for Product ${data.productId}: ${data.currentPrice}`);

            this.server.emit(`product_${data.productId}_update`, data);
        } catch (error) {
            this.logger.error(`Failed to handle auction update: ${error}`);
        }
    }

    handleConnection(client: any) {
        this.logger.log(`Client connected: ${client.id}`);
    }

    handleDisconnect(client: any) {
        this.logger.log(`Client disconnected: ${client.id}`);
    }
}

@Module({})
export class BiddingModule { }
