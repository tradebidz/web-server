TRUNCATE TABLE 
  chat_messages, 
  product_questions, 
  feedbacks, 
  banned_bidders, 
  bids, 
  watchlists, 
  product_descriptions, 
  product_images, 
  products, 
  categories, 
  upgrade_requests, 
  users 
RESTART IDENTITY CASCADE;

INSERT INTO users (email, password, full_name, role, rating_score, rating_count, is_verified, address) VALUES
-- 1. Admin
('admin@gmail.com', '$2b$10$EpIxNwYfbQ5d4gJ3h1J1.e/3.1.1.1.1.1.1.1.1.1.1.1', 'Admin Quản Trị', 'ADMIN', 10, 100, true, 'Hà Nội'),

-- 2. Seller (Người bán uy tín)
('seller@gmail.com', '$2b$10$EpIxNwYfbQ5d4gJ3h1J1.e/3.1.1.1.1.1.1.1.1.1.1.1', 'Shop Công Nghệ HCM', 'SELLER', 9.5, 50, true, 'TP.HCM'),

-- 3. Bidder 1 (Người mua thường)
('bidder1@gmail.com', '$2b$10$EpIxNwYfbQ5d4gJ3h1J1.e/3.1.1.1.1.1.1.1.1.1.1.1', 'Nguyễn Văn A', 'BIDDER', 8.0, 10, true, 'Đà Nẵng'),

-- 4. Bidder 2 (Người mua đại gia)
('bidder2@gmail.com', '$2b$10$EpIxNwYfbQ5d4gJ3h1J1.e/3.1.1.1.1.1.1.1.1.1.1.1', 'Trần Thị B', 'BIDDER', 10.0, 5, true, 'Cần Thơ'),

-- 5. Bidder 3 (Người mua mới - chưa có rating)
('bidder3@gmail.com', '$2b$10$EpIxNwYfbQ5d4gJ3h1J1.e/3.1.1.1.1.1.1.1.1.1.1.1', 'Lê Văn C', 'BIDDER', 0, 0, true, 'Hải Phòng');

INSERT INTO categories (name, parent_id) VALUES
('Điện tử', NULL),      -- ID 1
('Thời trang', NULL),   -- ID 2
('Gia dụng', NULL);     -- ID 3

INSERT INTO categories (name, parent_id) VALUES
('Điện thoại di động', 1), -- ID 4
('Máy tính xách tay', 1),  -- ID 5
('Giày dép', 2),           -- ID 6
('Đồng hồ', 2);            -- ID 7

INSERT INTO products (seller_id, category_id, name, description, start_price, step_price, buy_now_price, start_time, end_time, status) VALUES
-- SP 1: iPhone 15 (Đang đấu giá - Hot)
(2, 4, 'iPhone 15 Pro Max Titanium 256GB VN/A', '<p>Máy mới 99%, còn bảo hành Apple Care 6 tháng. Full box đầy đủ phụ kiện.</p>', 20000000, 500000, 28000000, NOW(), NOW() + INTERVAL '3 days', 'ACTIVE'),

-- SP 2: MacBook Pro (Sắp kết thúc - 10 phút nữa)
(2, 5, 'MacBook Pro M1 2020 16GB/512GB', '<p>Máy dùng lướt, sạc 50 lần. Ngoại hình đẹp keng không vết xước.</p>', 18000000, 200000, NULL, NOW() - INTERVAL '2 days', NOW() + INTERVAL '10 minutes', 'ACTIVE'),

-- SP 3: Giày Nike (Đã kết thúc)
(2, 6, 'Giày Nike Air Jordan 1 Low', '<p>Size 42, hàng authentic bao check.</p>', 2000000, 100000, 5000000, NOW() - INTERVAL '5 days', NOW() - INTERVAL '1 day', 'SOLD'),

-- SP 4: Đồng hồ Casio (Mới đăng)
(2, 7, 'Đồng hồ Casio G-Shock GA-2100', '<p>Bản Custom kim loại cực ngầu.</p>', 1500000, 50000, 3000000, NOW(), NOW() + INTERVAL '7 days', 'ACTIVE'),

-- SP 5: Samsung S24 (Tiếng Việt có dấu để test search)
(2, 4, 'Điện thoại Samsung Galaxy S24 Ultra', '<p>Siêu phẩm AI, Zoom 100x.</p>', 22000000, 500000, 30000000, NOW(), NOW() + INTERVAL '5 days', 'ACTIVE');

-- Cập nhật người thắng cho sản phẩm đã bán (SP 3)
UPDATE products SET winner_id = 4 WHERE id = 3; -- Bidder 2 thắng

INSERT INTO product_images (product_id, url, is_primary) VALUES
-- iPhone
(1, 'https://cdn.tgdd.vn/Products/Images/42/305658/iphone-15-pro-max-blue-thumbnew-600x600.jpg', true),
(1, 'https://cdn.tgdd.vn/Products/Images/42/305658/iphone-15-pro-max-titan-tu-nhien-1-1.jpg', false),
-- MacBook
(2, 'https://cdn.tgdd.vn/Products/Images/44/239560/macbook-pro-m1-2020-gray-600x600.jpg', true),
-- Giày
(3, 'https://cdn.tgdd.vn/Files/2021/08/17/1375836/nike-jordan-1-low-cam-1.jpg', true),
-- Đồng hồ
(4, 'https://cdn.tgdd.vn/Products/Images/7243/226164/casio-ga-2100-1a1dr-nam-1-600x600.jpg', true),
-- Samsung
(5, 'https://cdn.tgdd.vn/Products/Images/42/307172/samsung-galaxy-s24-ultra-grey-thumbnew-600x600.jpg', true);

INSERT INTO bids (product_id, bidder_id, amount, max_amount, time, is_auto_bid) VALUES
-- Đấu giá cho iPhone (SP 1) - Giá khởi điểm 20tr
(1, 3, 20000000, 20000000, NOW() - INTERVAL '1 day', false),      -- Bidder 1 vào giá
(1, 4, 20500000, 25000000, NOW() - INTERVAL '20 hours', false),   -- Bidder 2 vào giá, set auto max 25tr
(1, 3, 21000000, 21000000, NOW() - INTERVAL '15 hours', false),   -- Bidder 1 bid tiếp
(1, 4, 21500000, 25000000, NOW() - INTERVAL '15 hours', true),    -- Hệ thống tự bid cho Bidder 2 (do có auto)

-- Đấu giá cho MacBook (SP 2) - Cạnh tranh gay cấn
(2, 3, 18000000, 18000000, NOW() - INTERVAL '2 days', false),
(2, 5, 18200000, 18200000, NOW() - INTERVAL '1 day', false),
(2, 3, 18400000, 18400000, NOW() - INTERVAL '1 hour', false);

-- Cập nhật giá hiện tại cho sản phẩm dựa trên bid cuối
UPDATE products SET current_price = 21500000 WHERE id = 1;
UPDATE products SET current_price = 18400000 WHERE id = 2;
UPDATE products SET current_price = 2500000 WHERE id = 3; -- Giá chốt của giày

INSERT INTO watchlists (user_id, product_id) VALUES
(3, 1), -- Bidder 1 thích iPhone
(3, 2), -- Bidder 1 thích MacBook
(4, 1); -- Bidder 2 thích iPhone

INSERT INTO feedbacks (product_id, from_user_id, to_user_id, score, comment) VALUES
(3, 4, 2, 1, 'Giày đẹp, shop giao nhanh, uy tín!'); -- Bidder 2 khen Seller

SELECT setval('users_id_seq', (SELECT MAX(id) FROM users));
SELECT setval('categories_id_seq', (SELECT MAX(id) FROM categories));
SELECT setval('products_id_seq', (SELECT MAX(id) FROM products));
SELECT setval('product_images_id_seq', (SELECT MAX(id) FROM product_images));
SELECT setval('bids_id_seq', (SELECT MAX(id) FROM bids));
SELECT setval('feedbacks_id_seq', (SELECT MAX(id) FROM feedbacks));