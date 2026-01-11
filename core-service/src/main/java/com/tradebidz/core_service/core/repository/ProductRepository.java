package com.tradebidz.core_service.core.repository;

import com.tradebidz.core_service.core.entity.Product;
import jakarta.persistence.LockModeType;
import com.tradebidz.core_service.core.enums.ProductStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface ProductRepository extends JpaRepository<Product, Integer> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT p FROM Product p WHERE p.id = :id")
    Optional<Product> findByIdWithLock(Integer id);

    List<Product> findAllByStatusAndEndTimeBefore(ProductStatus status, LocalDateTime endTime);
}
