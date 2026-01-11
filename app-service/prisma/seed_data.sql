-- ============================================
-- QUICK SEED DATA FOR DEMO
-- ============================================

-- TRUNCATE tất cả tables (reset về 0)
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

-- ============================================
-- 1. USERS (9 users:  1 admin, 3 sellers, 5 bidders)
-- ============================================
INSERT INTO users (email, password, full_name, role, rating_score, rating_count, is_verified, address) VALUES
-- Admin
('admin@auction.com', '$2b$10$EpIxNwYfbQ5d4gJ3h1J1. e/3. 1. 1. 1.1.1.1.1.1.1.1.1', 'Admin', 'ADMIN', 100. 0, 100, true, 'TP. HCM'),

-- Sellers (3)
('seller1@gmail.com', '$2b$10$EpIxNwYfbQ5d4gJ3h1J1.e/3.1.1.1.1.1.1.1.1.1.1.1', 'Tech Store', 'SELLER', 95.5, 120, true, 'Quận 1, TP.HCM'),
('seller2@gmail.com', '$2b$10$EpIxNwYfbQ5d4gJ3h1J1.e/3.1.1.1.1.1.1.1.1.1.1.1', 'Fashion Shop', 'SELLER', 92.3, 85, true, 'Hà Nội'),
('seller3@gmail.com', '$2b$10$EpIxNwYfbQ5d4gJ3h1J1.e/3.1.1.1.1.1.1.1.1.1.1.1', 'Home & Living', 'SELLER', 88.7, 60, true, 'Đà Nẵng'),

-- Bidders (5)
('bidder1@gmail.com', '$2b$10$EpIxNwYfbQ5d4gJ3h1J1.e/3.1.1.1.1.1.1.1.1.1.1.1', 'Nguyễn Văn A', 'BIDDER', 89.2, 25, true, 'TP.HCM'),
('bidder2@gmail.com', '$2b$10$EpIxNwYfbQ5d4gJ3h1J1.e/3.1.1.1.1.1.1.1.1.1.1.1', 'Trần Thị B', 'BIDDER', 95.8, 40, true, 'Hà Nội'),
('bidder3@gmail.com', '$2b$10$EpIxNwYfbQ5d4gJ3h1J1.e/3.1.1.1.1.1.1.1.1.1.1.1', 'Lê Văn C', 'BIDDER', 78.5, 15, true, 'Đà Nẵng'),
('bidder4@gmail.com', '$2b$10$EpIxNwYfbQ5d4gJ3h1J1.e/3.1.1.1.1.1.1.1.1.1.1.1', 'Phạm Thị D', 'BIDDER', 92.1, 30, true, 'Cần Thơ'),
('bidder5@gmail.com', '$2b$10$EpIxNwYfbQ5d4gJ3h1J1.e/3.1.1.1.1.1.1.1.1.1.1.1', 'Hoàng Văn E', 'BIDDER', 85.6, 20, true, 'Hải Phòng');

-- ============================================
-- 2. CATEGORIES (3 parent + 6 children)
-- ============================================
INSERT INTO categories (name, parent_id) VALUES
('Điện tử', NULL),           -- 1
('Thời trang', NULL),        -- 2  
('Gia dụng', NULL);          -- 3

INSERT INTO categories (name, parent_id) VALUES
('Điện thoại', 1),           -- 4
('Laptop', 1),               -- 5
('Giày dép', 2),             -- 6
('Đồng hồ', 2),              -- 7
('Nội thất', 3),             -- 8
('Nhà bếp', 3);              -- 9

-- ============================================
-- 3. UPGRADE REQUESTS (2 requests)
-- ============================================
INSERT INTO upgrade_requests (user_id, reason, status, created_at) VALUES
(5, 'Tôi muốn bán đồ điện tử cũ, có kinh nghiệm 2 năm. ', 'PENDING', NOW() - INTERVAL '3 days'),
(7, 'Muốn mở shop giày sneaker trên sàn. ', 'APPROVED', NOW() - INTERVAL '10 days');

-- ============================================
-- 4. PRODUCTS (8 products:  6 active, 1 sold, 1 expired)
-- ============================================
INSERT INTO products (seller_id, category_id, name, description, start_price, step_price, buy_now_price, start_time, end_time, status, current_price, winner_id) VALUES
-- ACTIVE - Sắp kết thúc (2-6 giờ)
(2, 4, 'iPhone 14 Pro 256GB Chính hãng VN/A', '<p>Máy đẹp 99%, pin 96%. Fullbox đầy đủ. Bảo hành 6 tháng.</p>', 18000000, 300000, 25000000, NOW() - INTERVAL '2 days', NOW() + INTERVAL '3 hours', 'ACTIVE', 19200000, NULL),

(2, 5, 'MacBook Pro M1 16GB/512GB', '<p>Máy dùng 6 tháng, sạc 30 lần. Bảo hành Apple 10 tháng.</p>', 22000000, 500000, 30000000, NOW() - INTERVAL '1 day', NOW() + INTERVAL '5 hours', 'ACTIVE', 23500000, NULL),

-- ACTIVE - Còn vài ngày
(2, 4, 'Samsung Galaxy S24 Ultra 512GB', '<p>Siêu phẩm AI, camera zoom 100x. Mới seal 100%.</p>', 25000000, 500000, 32000000, NOW() - INTERVAL '1 day', NOW() + INTERVAL '3 days', 'ACTIVE', 26000000, NULL),

(3, 6, 'Nike Air Jordan 1 Low size 42', '<p>Giày authentic, có bill Nike. Mới 100% chưa đi.</p>', 3000000, 100000, 5000000, NOW() - INTERVAL '12 hours', NOW() + INTERVAL '2 days', 'ACTIVE', 3200000, NULL),

(3, 7, 'Apple Watch Ultra 2 Titanium 49mm', '<p>Đồng hồ thông minh cao cấp. Pin 36 giờ. Chống nước 100m.</p>', 18000000, 300000, 22000000, NOW(), NOW() + INTERVAL '4 days', 'ACTIVE', 18000000, NULL),

(4, 8, 'Ghế gaming DXRacer Formula Series', '<p>Ghế chơi game cao cấp, ngả 135 độ. Đệm memory foam.</p>', 4000000, 100000, 7000000, NOW() - INTERVAL '6 hours', NOW() + INTERVAL '2 days', 'ACTIVE', 4100000, NULL),

-- SOLD (đã có winner)
(2, 5, 'Dell XPS 13 i7/16GB/512GB', '<p>Laptop văn phòng cao cấp. Màn 4K OLED. Pin 10 giờ.</p>', 20000000, 300000, 26000000, NOW() - INTERVAL '7 days', NOW() - INTERVAL '2 days', 'SOLD', 22100000, 6),

-- EXPIRED
(3, 6, 'Adidas Yeezy Boost 350 V2', '<p>Giày Kanye West. Size 41. Chưa qua sử dụng.</p>', 5000000, 150000, 8000000, NOW() - INTERVAL '10 days', NOW() - INTERVAL '3 days', 'EXPIRED', 5000000, NULL);

-- ============================================
-- 5. PRODUCT IMAGES (1-2 ảnh mỗi sản phẩm)
-- ============================================
INSERT INTO product_images (product_id, url, is_primary) VALUES
(1, 'https://cdn2.cellphones.com.vn/insecure/rs:fill:0:358/q:90/plain/https://cellphones.com.vn/media/catalog/product/i/p/iphone-14-pro-1tb-2_1.png', true),
(2, 'https://m.media-amazon.com/images/I/61wjh-I8dHL._AC_UF894,1000_QL80_.jpg', true),
(3, 'https://i.ebayimg.com/images/g/DksAAeSwmIdoL3Jv/s-l1200.png', true),
(4, 'https://i.ebayimg.com/images/g/1KQAAOSwiiFlkAQf/s-l1200.jpg', true),
(5, 'https://i5.walmartimages.com/seo/Apple-Watch-Ultra-2-GPS-Cellular-49mm-Titanium-Case-with-Olive-Alpine-Loop-Medium_31ed648c-de5a-4f82-9921-a3a0ca5f309d.bff57864597b72054ad9eb5cde5b3fc2.jpeg', true),
(6, 'https://www.maxgaming.com/bilder/artiklar/zoom/32122_1.jpg?m=1735821962', true),
(7, 'https://m.media-amazon.com/images/I/61kn7cyc46L.jpg', true);

-- ============================================
-- 6. PRODUCT DESCRIPTIONS
-- ============================================
INSERT INTO product_descriptions (product_id, content, created_at) VALUES
(1, '<h3>Thông số kỹ thuật: </h3><ul><li>Chip:  A16 Bionic</li><li>RAM: 6GB</li><li>Bộ nhớ:  256GB</li><li>Màn hình: 6.1" Super Retina XDR</li><li>Camera: 48MP</li></ul>', NOW() - INTERVAL '2 days'),
(2, '<h3>Thông số kỹ thuật:</h3><ul><li>Chip: Apple M1</li><li>RAM: 16GB</li><li>SSD: 512GB</li><li>Màn hình: 13.3" Retina</li><li>Pin: 17 giờ</li></ul>', NOW() - INTERVAL '1 day'),
(3, '<h3>Thông số kỹ thuật:</h3><ul><li>Chip: Snapdragon 8 Gen 3</li><li>RAM: 12GB</li><li>Bộ nhớ: 512GB</li><li>Camera: 200MP zoom 100x</li><li>Pin:  5000mAh</li></ul>', NOW() - INTERVAL '1 day');

-- ============================================
-- 7. BIDS (Lịch sử đấu giá)
-- ============================================
INSERT INTO bids (product_id, bidder_id, amount, max_amount, time, is_auto_bid, status) VALUES
-- iPhone 14 Pro (Product 1) - Cạnh tranh gay gắt
(1, 5, 18000000, 18000000, NOW() - INTERVAL '2 days', false, 'VALID'),
(1, 6, 18300000, 20000000, NOW() - INTERVAL '1 day 20 hours', false, 'VALID'),
(1, 5, 18600000, 18600000, NOW() - INTERVAL '1 day 18 hours', false, 'VALID'),
(1, 6, 18900000, 20000000, NOW() - INTERVAL '1 day 18 hours', true, 'VALID'),
(1, 8, 19200000, 19200000, NOW() - INTERVAL '1 day 12 hours', false, 'VALID'),

-- MacBook Pro (Product 2)
(2, 6, 22000000, 22000000, NOW() - INTERVAL '1 day', false, 'VALID'),
(2, 8, 22500000, 25000000, NOW() - INTERVAL '20 hours', false, 'VALID'),
(2, 6, 23000000, 23000000, NOW() - INTERVAL '18 hours', false, 'VALID'),
(2, 8, 23500000, 25000000, NOW() - INTERVAL '18 hours', true, 'VALID'),

-- Samsung S24 (Product 3)
(3, 5, 25000000, 25000000, NOW() - INTERVAL '1 day', false, 'VALID'),
(3, 7, 25500000, 27000000, NOW() - INTERVAL '20 hours', false, 'VALID'),
(3, 5, 26000000, 26000000, NOW() - INTERVAL '15 hours', false, 'VALID'),

-- Nike Jordan (Product 4)
(4, 7, 3000000, 3000000, NOW() - INTERVAL '10 hours', false, 'VALID'),
(4, 9, 3100000, 3500000, NOW() - INTERVAL '8 hours', false, 'VALID'),
(4, 7, 3200000, 3200000, NOW() - INTERVAL '6 hours', false, 'VALID'),

-- Gaming Chair (Product 6)
(6, 5, 4000000, 4000000, NOW() - INTERVAL '5 hours', false, 'VALID'),
(6, 9, 4100000, 4100000, NOW() - INTERVAL '3 hours', false, 'VALID'),

-- Dell XPS (Product 7 - SOLD)
(7, 6, 20000000, 20000000, NOW() - INTERVAL '7 days', false, 'VALID'),
(7, 8, 20300000, 22000000, NOW() - INTERVAL '6 days', false, 'VALID'),
(7, 6, 20600000, 20600000, NOW() - INTERVAL '5 days', false, 'VALID'),
(7, 8, 20900000, 22000000, NOW() - INTERVAL '5 days', true, 'VALID'),
(7, 6, 21200000, 21200000, NOW() - INTERVAL '4 days', false, 'VALID'),
(7, 8, 21500000, 22000000, NOW() - INTERVAL '4 days', true, 'VALID'),
(7, 6, 21800000, 21800000, NOW() - INTERVAL '3 days', false, 'VALID'),
(7, 8, 22100000, 22100000, NOW() - INTERVAL '3 days', false, 'VALID');

-- ============================================
-- 8. WATCHLISTS (Theo dõi sản phẩm)
-- ============================================
INSERT INTO watchlists (user_id, product_id, created_at) VALUES
(5, 1, NOW() - INTERVAL '3 days'),
(5, 2, NOW() - INTERVAL '2 days'),
(5, 3, NOW() - INTERVAL '1 day'),
(6, 1, NOW() - INTERVAL '2 days'),
(6, 2, NOW() - INTERVAL '1 day'),
(7, 4, NOW() - INTERVAL '1 day'),
(8, 1, NOW() - INTERVAL '1 day'),
(8, 3, NOW() - INTERVAL '12 hours'),
(9, 6, NOW() - INTERVAL '6 hours');

-- ============================================
-- 9. FEEDBACKS (Đánh giá sau giao dịch SOLD)
-- ============================================
INSERT INTO feedbacks (product_id, from_user_id, to_user_id, score, comment, created_at) VALUES
-- Dell XPS (Product 7) - Bidder 6 (winner) đánh giá Seller 2
(7, 6, 2, 1, 'Laptop đẹp như mô tả, seller giao hàng nhanh.  Rất hài lòng!  ', NOW() - INTERVAL '1 day'),
-- Seller 2 đánh giá Bidder 6
(7, 2, 6, 1, 'Buyer thanh toán nhanh, giao dịch dễ chịu. Recommend! ', NOW() - INTERVAL '1 day');

-- ============================================
-- 10. PRODUCT QUESTIONS (Hỏi đáp)
-- ============================================
INSERT INTO product_questions (product_id, user_id, question, answer, created_at, answered_at) VALUES
-- iPhone 14 Pro
(1, 5, 'Máy có lock hay quốc tế ạ? Pin health bao nhiêu %?', 'Máy quốc tế VN/A, pin health 96% bạn nhé. ', NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days' + INTERVAL '1 hour'),
(1, 8, 'Còn bảo hành đến khi nào vậy shop? ', 'Bảo hành đến tháng 8/2025 bạn, còn 6 tháng. ', NOW() - INTERVAL '1 day', NOW() - INTERVAL '23 hours'),

-- MacBook Pro
(2, 6, 'Pin còn bao nhiêu chu kỳ sạc ạ?', 'Pin sạc khoảng 30 chu kỳ thôi bạn, còn rất mới.', NOW() - INTERVAL '1 day', NOW() - INTERVAL '23 hours'),

-- Samsung S24
(3, 5, 'Máy seal nghĩa là chưa kích hoạt phải không?', 'Đúng rồi bạn, máy nguyên seal 100%, chưa lên nguồn.', NOW() - INTERVAL '20 hours', NOW() - INTERVAL '19 hours'),

-- Nike Jordan - Chưa trả lời
(4, 7, 'Giày có bill Nike không ạ?', NULL, NOW() - INTERVAL '8 hours', NULL);

-- ============================================
-- 11. CHAT MESSAGES (Tin nhắn)
-- ============================================
INSERT INTO chat_messages (product_id, sender_id, receiver_id, content, is_read, created_at) VALUES
-- Chat về iPhone 14 Pro
(1, 5, 2, 'Chào shop, cho em hỏi máy có trầy xước gì không ạ?', true, NOW() - INTERVAL '2 days'),
(1, 2, 5, 'Máy không trầy xước bạn, dùng kèm ốp và dán kính từ đầu. ', true, NOW() - INTERVAL '2 days' + INTERVAL '5 minutes'),
(1, 5, 2, 'Ok cảm ơn shop.  Em sẽ tham gia đấu giá!  ', true, NOW() - INTERVAL '2 days' + INTERVAL '10 minutes'),

-- Chat về MacBook Pro
(2, 6, 2, 'Shop nhận COD không ạ?', true, NOW() - INTERVAL '1 day'),
(2, 2, 6, 'Nhận COD bạn, hoặc chuyển khoản 50% trước cũng được.', true, NOW() - INTERVAL '1 day' + INTERVAL '3 minutes'),

-- Chat chưa đọc
(3, 8, 2, 'Shop có ship ngoại tỉnh không ạ?', false, NOW() - INTERVAL '2 hours'),
(4, 7, 3, 'Giày có fullbox không shop? ', false, NOW() - INTERVAL '1 hour');

-- ============================================
-- 12. BANNED BIDDERS (Người bị cấm)
-- ============================================
INSERT INTO banned_bidders (product_id, user_id, reason, created_at) VALUES
-- Seller 2 cấm Bidder 7 khỏi iPhone
(1, 7, 'Bidder đã thắng đấu giá sản phẩm trước nhưng không thanh toán.', NOW() - INTERVAL '3 days'),
-- Seller 3 cấm Bidder 9 khỏi Apple Watch
(5, 9, 'Bidder hỏi quá nhiều câu không liên quan, nghi ngờ không mua thật.', NOW() - INTERVAL '1 day');

-- ============================================
-- VERIFICATION:  Kiểm tra data
-- ============================================
SELECT 
    'Users' as table_name, COUNT(*):: text as count FROM users
UNION ALL SELECT 'Categories', COUNT(*)::text FROM categories
UNION ALL SELECT 'Products', COUNT(*)::text FROM products
UNION ALL SELECT '  - ACTIVE', COUNT(*)::text FROM products WHERE status = 'ACTIVE'
UNION ALL SELECT '  - SOLD', COUNT(*)::text FROM products WHERE status = 'SOLD'
UNION ALL SELECT 'Bids', COUNT(*)::text FROM bids
UNION ALL SELECT 'Watchlists', COUNT(*)::text FROM watchlists
UNION ALL SELECT 'Feedbacks', COUNT(*)::text FROM feedbacks
UNION ALL SELECT 'Questions', COUNT(*)::text FROM product_questions
UNION ALL SELECT 'Chat Messages', COUNT(*)::text FROM chat_messages
UNION ALL SELECT 'Banned Bidders', COUNT(*)::text FROM banned_bidders
UNION ALL SELECT 'Upgrade Requests', COUNT(*)::text FROM upgrade_requests;

-- ============================================
-- DEMO DATA: Sản phẩm sắp kết thúc (HOT)
-- ============================================
SELECT 
    '🔥 SẢN PHẨM SẮP KẾT THÚC' as info,
    id,
    name,
    start_price,
    current_price,
    ROUND(EXTRACT(EPOCH FROM (end_time - NOW()))/3600, 1) as hours_left,
    (SELECT COUNT(*) FROM bids WHERE product_id = products.id) as bid_count
FROM products 
WHERE status = 'ACTIVE' 
    AND end_time < NOW() + INTERVAL '12 hours'
ORDER BY end_time ASC;

-- ============================================
-- DEMO DATA: Top Bidders
-- ============================================
SELECT 
    '👥 TOP BIDDERS' as info,
    u.id,
    u.full_name,
    u.rating_score,
    COUNT(b. id) as total_bids,
    SUM(b.amount) as total_bid_amount
FROM users u
LEFT JOIN bids b ON u.id = b.bidder_id
WHERE u.role = 'BIDDER'
GROUP BY u.id, u.full_name, u.rating_score
ORDER BY total_bids DESC;