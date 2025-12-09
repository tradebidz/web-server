package com.tradebidz.core_service.core.entity;

import com.tradebidz.core_service.core.enums.BidStatus;
import jakarta.persistence.*;
import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "bids")
@Data
public class Bid {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(name = "product_id")
    private Integer productId;

    @Column(name = "bidder_id")
    private Integer bidderId;

    private BigDecimal amount;

    @Column(name = "max_amount")
    private BigDecimal maxAmount;

    @Column(name = "is_auto_bid")
    private Boolean isAutoBid;

    private LocalDateTime time;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", columnDefinition = "bid_status")
    private BidStatus status;
}