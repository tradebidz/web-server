package com.tradebidz.core_service.core.scheduler;

import com.tradebidz.core_service.core.entity.Product;
import com.tradebidz.core_service.core.entity.User;
import com.tradebidz.core_service.core.enums.ProductStatus;
import com.tradebidz.core_service.core.repository.ProductRepository;
import com.tradebidz.core_service.core.repository.UserRepository;
import com.tradebidz.core_service.core.service.NotificationService;
import lombok.RequiredArgsConstructor;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.List;

@Component
@RequiredArgsConstructor
public class AuctionScheduler {

    private final ProductRepository productRepo;
    private final UserRepository userRepo;
    private final NotificationService notificationService;
    // Assuming you might need RedisService for other updates, but purely for emails NotificationService is enough.
    // If you need to broadcast updates to FE (like "auction ended"), you might need it.

    @Scheduled(fixedRate = 60000) // Run every 60 seconds
    public void scanExpiredAuctions() {
        LocalDateTime now = LocalDateTime.now();
        List<Product> expiredProducts = productRepo.findAllByStatusAndEndTimeBefore(ProductStatus.ACTIVE, now);

        if (!expiredProducts.isEmpty()) {
            System.out.println("Found " + expiredProducts.size() + " expired auctions. Processing...");
        }

        for (Product product : expiredProducts) {
            try {
                processExpiredAuction(product);
            } catch (Exception e) {
                System.err.println("Error processing expired auction " + product.getId() + ": " + e.getMessage());
                e.printStackTrace();
            }
        }
    }

    private void processExpiredAuction(Product product) {
        if (product.getWinnerId() != null) {
            // Auction Success
            product.setStatus(ProductStatus.SOLD);
            product.setCurrentPrice(product.getCurrentPrice()); // Ensure price is final
            // product.setUpdatedAt(LocalDateTime.now()); // If there is an updatedAt field
            
            productRepo.save(product);

            System.out.println("Auction " + product.getId() + " SOLD to user " + product.getWinnerId());
            sendAuctionSuccessNotification(product);
        } else {
            // Auction Failed (No Bids)
            product.setStatus(ProductStatus.EXPIRED); // Or whatever status you use for no-bid expire
            productRepo.save(product);

            System.out.println("Auction " + product.getId() + " EXPIRED with no bids.");
            sendAuctionFailNotification(product);
        }
    }

    private void sendAuctionSuccessNotification(Product product) {
        User seller = userRepo.findById(product.getSellerId()).orElse(null);
        User winner = userRepo.findById(product.getWinnerId()).orElse(null);

        if (seller != null && winner != null) {
            notificationService.sendAuctionSuccessEmail(
                    product.getId(),
                    product.getName(),
                    product.getCurrentPrice().toString(),
                    seller.getEmail(),
                    seller.getFullName(),
                    winner.getEmail(),
                    winner.getFullName(),
                    winner.getAddress()
            );
        }
    }

    private void sendAuctionFailNotification(Product product) {
        User seller = userRepo.findById(product.getSellerId()).orElse(null);

        if (seller != null) {
            notificationService.sendAuctionFailEmail(
                    product.getName(),
                    seller.getEmail()
            );
        }
    }
}
