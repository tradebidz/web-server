package com.tradebidz.core_service.core.service;

import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.connection.stream.MapRecord;
import org.springframework.data.redis.connection.stream.StreamRecords;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class NotificationService {

    private final RedisTemplate<String, Object> redisTemplate;
    private static final String NOTIFICATION_STREAM = "notification_stream";

    public void sendBidPlacedEmail(
            String productName,
            String newPrice,
            String sellerEmail,
            String bidderEmail,
            String prevBidderEmail
    ) {
        try {
            Map<String, String> data = new HashMap<>();
            data.put("type", "BID_PLACED");
            data.put("product_name", productName);
            data.put("new_price", newPrice);
            data.put("seller_email", sellerEmail);
            data.put("bidder_email", bidderEmail);
            data.put("prev_bidder_email", prevBidderEmail != null ? prevBidderEmail : "");

            MapRecord<String, String, String> record = StreamRecords.mapBacked(data)
                    .withStreamKey(NOTIFICATION_STREAM);

            redisTemplate.opsForStream().add(record);
            System.out.println("BID_PLACED email event sent for product: " + productName);
        } catch (Exception e) {
            System.err.println("Failed to send BID_PLACED email event: " + e.getMessage());
            e.printStackTrace();
        }
    }

    public void sendAuctionSuccessEmail(
            String productName,
            String price,
            String sellerEmail,
            String winnerEmail
    ) {
        try {
            Map<String, String> data = new HashMap<>();
            data.put("type", "AUCTION_SUCCESS");
            data.put("product_name", productName);
            data.put("price", price);
            data.put("seller_email", sellerEmail);
            data.put("winner_email", winnerEmail);

            MapRecord<String, String, String> record = StreamRecords.mapBacked(data)
                    .withStreamKey(NOTIFICATION_STREAM);

            redisTemplate.opsForStream().add(record);
            System.out.println("AUCTION_SUCCESS email event sent for product: " + productName);
        } catch (Exception e) {
            System.err.println("Failed to send AUCTION_SUCCESS email event: " + e.getMessage());
            e.printStackTrace();
        }
    }

    public void sendAuctionFailEmail(
            String productName,
            String sellerEmail
    ) {
        try {
            Map<String, String> data = new HashMap<>();
            data.put("type", "AUCTION_FAIL");
            data.put("product_name", productName);
            data.put("seller_email", sellerEmail);

            MapRecord<String, String, String> record = StreamRecords.mapBacked(data)
                    .withStreamKey(NOTIFICATION_STREAM);

            redisTemplate.opsForStream().add(record);
            System.out.println("AUCTION_FAIL email event sent for product: " + productName);
        } catch (Exception e) {
            System.err.println("Failed to send AUCTION_FAIL email event: " + e.getMessage());
            e.printStackTrace();
        }
    }

    public void sendBidRejectedEmail(
        String productName, 
        String price, 
        String bidderEmail
    ) {
        try {
            Map<String, String> data = new HashMap<>();
            data.put("type", "BID_REJECTED");
            data.put("product_name", productName);
            data.put("new_price", price);
            data.put("bidder_email", bidderEmail);

            MapRecord<String, String, String> record = StreamRecords.mapBacked(data)
                    .withStreamKey(NOTIFICATION_STREAM);

            redisTemplate.opsForStream().add(record);
            System.out.println("BID_REJECTED email event sent for product: " + productName);
        } catch (Exception e) {
            System.err.println("Failed to send BID_REJECTED email event: " + e.getMessage());
            e.printStackTrace();
        }
    }
}
