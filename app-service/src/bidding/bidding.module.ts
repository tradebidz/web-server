import { Module } from "@nestjs/common";
import { BiddingGateway } from "./bidding.gateway";

@Module({
    providers: [BiddingGateway]
})

export class BiddingModule { }
