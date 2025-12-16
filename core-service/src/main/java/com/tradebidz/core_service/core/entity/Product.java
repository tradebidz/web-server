package com.tradebidz.core_service.core.entity;

import jakarta.persistence.*;
import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "products")
@Data
public class Product {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(name = "start_price")
    private BigDecimal startPrice;

    @Column(name = "current_price")
    private BigDecimal currentPrice;

    @Column(name = "step_price")
    private BigDecimal stepPrice;

    @Column(name = "buy_now_price")
    private BigDecimal buyNowPrice;

    @Column(name = "end_time")
    private LocalDateTime endTime;

    @Column(name = "is_auto_extend")
    private Boolean isAutoExtend;

    private String status;

    @Column(name = "seller_id")
    private Integer sellerId;

    @Column(name = "winner_id")
    private Integer winnerId;

    private String name;
}
