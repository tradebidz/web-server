package com.tradebidz.core_service.core.controller;

import com.tradebidz.core_service.core.dto.BidRequest;
import com.tradebidz.core_service.core.service.BiddingService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/bids")
@RequiredArgsConstructor
public class BidController {
    private final BiddingService biddingService;

    @PostMapping
    public ResponseEntity<?> placeBid(
            @RequestHeader(value = "X-User-Id", defaultValue = "1") String userIdStr,
            @RequestBody BidRequest request) {
        Integer userId = Integer.parseInt(userIdStr);
        try {
            biddingService.placeBid(userId, request);
            return ResponseEntity.ok("Bid placed successfully");
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @PostMapping("/{productId}/buy-now")
    public ResponseEntity<?> buyNow(
            @RequestHeader(value = "X-User-Id", defaultValue = "1") String userIdStr,
            @PathVariable("productId") Integer productId) {
        Integer userId = Integer.parseInt(userIdStr);
        try {
            biddingService.buyNow(userId, productId);
            return ResponseEntity.ok("Mua ngay thành công");
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }
}
