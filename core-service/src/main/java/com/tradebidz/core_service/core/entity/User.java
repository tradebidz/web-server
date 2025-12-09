package com.tradebidz.core_service.core.entity;


import jakarta.persistence.*;
import lombok.Data;

@Entity
@Table(name = "users")
@Data
public class User {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    private String email;

    @Column(name = "full_name")
    private String fullName;

    @Column(name = "rating_score")
    private Double ratingScore;
}
