package com.tradebidz.core_service.core.repository;

import com.tradebidz.core_service.core.entity.Bid;
import com.tradebidz.core_service.core.enums.BidStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface BidRepository extends JpaRepository<Bid, Integer> {
    Optional<Bid> findTopByProductIdOrderByAmountDesc(Integer productId);

    Optional<Bid> findTopByProductIdAndStatusOrderByMaxAmountDescTimeAsc(Integer productId, BidStatus status);

    @Query("SELECT DISTINCT u.email FROM Bid b JOIN User u ON b.bidderId = u.id WHERE b.productId = :productId")
    List<String> findBidderEmails(@Param("productId") Integer productId);
}
