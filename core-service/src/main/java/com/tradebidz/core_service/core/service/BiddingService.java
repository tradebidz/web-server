package com.tradebidz.core_service.core.service;

import com.tradebidz.core_service.core.dto.BidRequest;
import com.tradebidz.core_service.core.entity.Bid;
import com.tradebidz.core_service.core.entity.Product;
import com.tradebidz.core_service.core.enums.BidStatus;
import com.tradebidz.core_service.core.repository.BidRepository;
import com.tradebidz.core_service.core.repository.ProductRepository;
import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;
import tools.jackson.databind.ObjectMapper;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class BiddingService {

    private final ProductRepository productRepo;
    private final BidRepository bidRepo;
    private final RedisTemplate<String, Object> redisTemplate;
    private final ObjectMapper objectMapper;

    @Transactional
    public void placeBid(Integer userId, BidRequest req) {
        Product product = productRepo.findByIdWithLock(req.getProductId())
                .orElseThrow(() -> new RuntimeException("Product not found"));

        LocalDateTime now = LocalDateTime.now();
        if (now.isAfter(product.getEndTime())) {
            throw new RuntimeException("Auction ended");
        }

        if (product.getIsAutoExtend() && product.getEndTime().minusMinutes(5).isBefore(now)) {
            product.setEndTime(product.getEndTime().plusMinutes(10));
        }

        BigDecimal minValidPrice = product.getCurrentPrice().add(product.getStepPrice());
        if (product.getCurrentPrice().compareTo(BigDecimal.ZERO) == 0) {
            minValidPrice = product.getStartPrice();
        }

        if (req.getAmount().compareTo(minValidPrice) < 0) {
            throw new RuntimeException("Price must be higher than current price + step");
        }

        Bid newBid = new Bid();
        newBid.setProductId(product.getId());
        newBid.setBidderId(userId);
        newBid.setAmount(req.getAmount());
        newBid.setTime(now);
        newBid.setStatus(BidStatus.VALID);

        // setup auto-bid for user
        if (Boolean.TRUE.equals(req.getIsAutoBid())) {
            newBid.setIsAutoBid(true);
            newBid.setMaxAmount(req.getMaxAmount());
        } else {
            newBid.setIsAutoBid(false);
            newBid.setMaxAmount(req.getAmount());
        }

        bidRepo.save(newBid);

        // update product price
        product.setCurrentPrice(newBid.getAmount());
        product.setWinnerId(userId);

        // handle auto bidding
        // simple approach: check history and find max amount > current user price
        Optional<Bid> opponentBidOpt = bidRepo.findTopByProductIdOrderByAmountDesc(product.getId());
        productRepo.save(product);
        sendUpdateToRedis(product, userId);
    }

    private void sendUpdateToRedis(Product product, Integer userId) {
        try {
            Map<String, Object> event = new HashMap<>();
            event.put("productId", product.getId());
            event.put("currentPrice",  product.getCurrentPrice());
            event.put("winnerId", userId);
            event.put("endTime", product.getEndTime().toString());

            String json = objectMapper.writeValueAsString(event);
            redisTemplate.convertAndSend("auction_updates", json);
            System.out.println("Sent Redis: " + json);
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}
