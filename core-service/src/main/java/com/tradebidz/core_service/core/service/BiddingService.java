package com.tradebidz.core_service.core.service;

import com.tradebidz.core_service.core.dto.BidRequest;
import com.tradebidz.core_service.core.entity.Bid;
import com.tradebidz.core_service.core.entity.Product;
import com.tradebidz.core_service.core.entity.User;
import com.tradebidz.core_service.core.enums.BidStatus;
import com.tradebidz.core_service.core.enums.ProductStatus;
import com.tradebidz.core_service.core.repository.BidRepository;
import com.tradebidz.core_service.core.repository.ProductRepository;
import com.tradebidz.core_service.core.repository.UserRepository;
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
    private final UserRepository userRepo;
    private final NotificationService notificationService;
    private final RedisTemplate<String, Object> redisTemplate;
    private final ObjectMapper objectMapper;

    @Transactional
    public void placeBid(Integer userId, BidRequest req) {
        Product product = productRepo.findByIdWithLock(req.getProductId())
                .orElseThrow(() -> new RuntimeException("Product not found"));

        if (!"ACTIVE".equals(product.getStatus().toString())) {
            throw new RuntimeException("Product is not active");
        }

        LocalDateTime now = LocalDateTime.now();
        if (now.isAfter(product.getEndTime())) {
            throw new RuntimeException("Auction ended");
        }

        if (Boolean.TRUE.equals(product.getIsAutoExtend()) &&
                product.getEndTime().minusMinutes(5).isBefore(now)) {
            product.setEndTime(product.getEndTime().plusMinutes(5));
        }

        BigDecimal challengerAmount = req.getAmount();
        BigDecimal challengerMax = Boolean.TRUE.equals(req.getIsAutoBid()) ? req.getMaxAmount() : req.getAmount();
        BigDecimal currentPrice = product.getCurrentPrice();
        BigDecimal stepPrice = product.getStepPrice();

        BigDecimal minValidPrice;

        if (product.getWinnerId() == null) {
            minValidPrice = product.getStartPrice();
        } else {
            minValidPrice = currentPrice.add(stepPrice);
        }

        if (challengerAmount.compareTo(minValidPrice) < 0) {
            throw new RuntimeException("Price must be equal or higher than " + minValidPrice);
        }

        Integer previousWinnerId = product.getWinnerId();

        Optional<Bid> currentLeaderOpt = bidRepo.findTopByProductIdAndStatusOrderByMaxAmountDescTimeAsc(
                product.getId(), BidStatus.VALID);
        
        System.out.println("DEBUG: Bid Request from User " + userId + ": Amount=" + challengerAmount + ", Max=" + challengerMax);

        if (currentLeaderOpt.isEmpty()) {
            System.out.println("DEBUG: No current leader. Creating first bid.");
            createBid(product, userId, challengerAmount, challengerMax, req.getIsAutoBid());
            updateProduct(product, challengerAmount, userId);
            sendBidPlacedEmailNotification(product, userId, previousWinnerId);
        } else {
            Bid leaderBid = currentLeaderOpt.get();
            BigDecimal leaderMax = leaderBid.getMaxAmount();
            System.out.println("DEBUG: Current Leader: " + leaderBid.getBidderId() + ", LeaderMax: " + leaderMax);

            if (leaderBid.getBidderId().equals(userId)) {
                // If winner increase their max price
                System.out.println("DEBUG: User is already the winner. Checking if raise...");
                if (challengerMax.compareTo(leaderMax) > 0) {
                    System.out.println("DEBUG: Raising own bid. OldMax: " + leaderMax + ", NewMax: " + challengerMax);
                    // OLD logic: leaderBid.setMaxAmount(challengerMax); bidRepo.save(leaderBid);
                    // NEW logic: Create new bid & Update price (jump to new bid amount)
                    
                    createBid(product, userId, challengerAmount, challengerMax, req.getIsAutoBid());
                    System.out.println("Executing consecutive bid logic: Creating new bid for user " + userId + " with amount " + challengerAmount);
                    updateProduct(product, challengerAmount, userId); // Price jumps to new amount
                    
                    sendBidPlacedEmailNotification(product, userId, previousWinnerId);
                } else {
                    System.out.println("DEBUG: Bid not higher than own max. Skipping update.");
                }
            } else {
                if (challengerMax.compareTo(leaderMax) > 0) {
                    BigDecimal newPrice = leaderMax.add(stepPrice);
                    if (newPrice.compareTo(challengerMax) > 0) {
                        newPrice = challengerMax;
                    }

                    createBid(product, userId, newPrice, challengerMax, req.getIsAutoBid());
                    updateProduct(product, newPrice, userId);
                    sendBidPlacedEmailNotification(product, userId, previousWinnerId);
                } else {
                    BigDecimal newPrice = challengerMax.add(stepPrice);

                    if (newPrice.compareTo(leaderMax) > 0) {
                        newPrice = leaderMax;
                    }

                    createBid(product, userId, challengerAmount, challengerMax, req.getIsAutoBid());
                    createBid(product, leaderBid.getBidderId(), newPrice, leaderMax, true);

                    updateProduct(product, newPrice, leaderBid.getBidderId());
                    sendBidPlacedEmailNotification(product, leaderBid.getBidderId(), userId);
                }
            }
        }

        sendRedisUpdate(product, userId);
    }

    @Transactional
    public void buyNow(Integer userId, Integer productId) {
        Product product = productRepo.findByIdWithLock(productId)
                .orElseThrow(() -> new RuntimeException("Sản phẩm không tồn tại"));

        if (!"ACTIVE".equals(product.getStatus().toString())) {
            throw new RuntimeException("Sản phẩm không còn trong trạng thái đấu giá");
        }

        if (product.getBuyNowPrice() == null) {
            throw new RuntimeException("Sản phẩm này không có giá mua ngay");
        }

        if (product.getSellerId().equals(userId)) {
            throw new RuntimeException("Người bán không thể mua sản phẩm của chính mình");
        }

        LocalDateTime now = LocalDateTime.now();
        if (now.isAfter(product.getEndTime())) {
            throw new RuntimeException("Cuộc đấu giá đã kết thúc");
        }

        // 1. Update product status to SOLD
        product.setStatus(ProductStatus.SOLD);
        product.setWinnerId(userId);
        product.setCurrentPrice(product.getBuyNowPrice());
        product.setUpdatedAt(now);
        productRepo.save(product);

        // 2. Create a bid record for the buy now transaction
        createBid(product, userId, product.getBuyNowPrice(), product.getBuyNowPrice(), false);

        // 3. Send notifications
        sendBuyNowEmailNotification(product, userId);
        sendRedisUpdate(product, userId);
    }

    private void sendBuyNowEmailNotification(Product product, Integer winnerId) {
        try {
            User seller = userRepo.findById(product.getSellerId()).orElse(null);
            User winner = userRepo.findById(winnerId).orElse(null);

            if (seller != null && winner != null) {
                notificationService.sendAuctionSuccessEmail(
                        product.getName(),
                        product.getBuyNowPrice().toString(),
                        seller.getEmail(),
                        winner.getEmail());
            }
        } catch (Exception e) {
            System.err.println("Failed to send buy now notification: " + e.getMessage());
        }
    }

    private void sendBidPlacedEmailNotification(Product product, Integer newWinnerId, Integer previousWinnerId) {
        try {
            User seller = userRepo.findById(product.getSellerId()).orElse(null);
            if (seller == null)
                return;

            User newWinner = userRepo.findById(newWinnerId).orElse(null);
            if (newWinner == null)
                return;

            String prevBidderEmail = "";
            if (previousWinnerId != null && !previousWinnerId.equals(newWinnerId)) {
                User prevBidder = userRepo.findById(previousWinnerId).orElse(null);
                if (prevBidder != null) {
                    prevBidderEmail = prevBidder.getEmail();
                }
            }

            notificationService.sendBidPlacedEmail(
                    product.getName(),
                    product.getCurrentPrice().toString(),
                    seller.getEmail(),
                    newWinner.getEmail(),
                    prevBidderEmail);
        } catch (Exception e) {
            System.err.println("Failed to send bid placed notification: " + e.getMessage());
        }
    }

    private void sendRedisUpdate(Product product, Integer userId) {
        try {
            Map<String, Object> event = new HashMap<>();
            event.put("productId", product.getId());
            event.put("currentPrice", product.getCurrentPrice());
            event.put("winnerId", userId);
            event.put("endTime", product.getEndTime().toString());

            String json = objectMapper.writeValueAsString(event);
            redisTemplate.convertAndSend("auction_updates", json);
            System.out.println("Sent Redis: " + json);
        } catch (Exception e) {
            System.err.println("Failed to send Redis update: " + e.getMessage());
        }
    }

    private void createBid(Product p, Integer userId, BigDecimal amount, BigDecimal maxAmount, Boolean isAuto) {
        Bid bid = new Bid();

        bid.setProductId(p.getId());
        bid.setBidderId(userId);
        bid.setAmount(amount);
        bid.setMaxAmount(maxAmount);
        bid.setIsAutoBid(isAuto);
        bid.setTime(LocalDateTime.now());
        bid.setStatus(BidStatus.VALID);

        bidRepo.save(bid);
    }

    private void updateProduct(Product p, BigDecimal newPrice, Integer newWinnerId) {
        p.setCurrentPrice(newPrice);
        p.setWinnerId(newWinnerId);

        productRepo.save(p);
    }
}
