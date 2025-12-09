package com.tradebidz.core_service.core.repository;

import com.tradebidz.core_service.core.entity.Bid;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface BidRepository extends JpaRepository<Bid, Integer> {
    Optional<Bid> findTopByProductIdOrderByAmountDesc(Integer productId);
}
