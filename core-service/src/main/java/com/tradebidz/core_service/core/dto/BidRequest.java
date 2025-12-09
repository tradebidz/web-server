package com.tradebidz.core_service.core.dto;

import lombok.Data;

import java.math.BigDecimal;

@Data
public class BidRequest {
    private Integer productId;
    private BigDecimal amount;
    private Boolean isAutoBid;
    private BigDecimal maxAmount;
}
