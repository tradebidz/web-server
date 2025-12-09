-- 1. Enable Extensions
CREATE EXTENSION IF NOT EXISTS "unaccent";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- 2. Define ENUMs (Nếu đã chạy rồi thì lệnh này sẽ báo lỗi tồn tại, có thể bỏ qua)
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('BIDDER', 'SELLER', 'ADMIN');
    CREATE TYPE product_status AS ENUM ('ACTIVE', 'SOLD', 'EXPIRED', 'CANCELLED');
    CREATE TYPE upgrade_status AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
    CREATE TYPE bid_status AS ENUM ('VALID', 'REJECTED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 3. Create Tables

-- USERS
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  address TEXT,
  role user_role DEFAULT 'BIDDER',
  rating_score FLOAT DEFAULT 0,
  rating_count INTEGER DEFAULT 0,
  is_verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- UPGRADE REQUESTS
CREATE TABLE IF NOT EXISTS upgrade_requests (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  reason TEXT,
  status upgrade_status DEFAULT 'PENDING',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- CATEGORIES
CREATE TABLE IF NOT EXISTS categories (
  id SERIAL PRIMARY KEY,
  parent_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- PRODUCTS (ĐÃ SỬA LỖI SEARCH VECTOR)
CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  seller_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  category_id INTEGER REFERENCES categories(id) ON DELETE RESTRICT,
  name VARCHAR(255) NOT NULL,
  thumbnail VARCHAR(255),
  description TEXT,
  
  -- Price
  start_price DECIMAL(15, 2) NOT NULL,
  current_price DECIMAL(15, 2) DEFAULT 0,
  step_price DECIMAL(15, 2) NOT NULL,
  buy_now_price DECIMAL(15, 2),
  
  -- Time
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  is_auto_extend BOOLEAN DEFAULT TRUE,
  
  -- Status & Meta
  status product_status DEFAULT 'ACTIVE',
  winner_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  view_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Cột này sẽ được Trigger tự động điền dữ liệu
  search_vector TSVECTOR
);

-- Tạo Index cho cột search_vector
CREATE INDEX IF NOT EXISTS idx_products_search ON products USING GIN(search_vector);

-- PRODUCT IMAGES
CREATE TABLE IF NOT EXISTS product_images (
  id SERIAL PRIMARY KEY,
  product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
  url VARCHAR(255) NOT NULL,
  is_primary BOOLEAN DEFAULT FALSE
);

-- PRODUCT DESCRIPTIONS
CREATE TABLE IF NOT EXISTS product_descriptions (
  id SERIAL PRIMARY KEY,
  product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- WATCHLISTS
CREATE TABLE IF NOT EXISTS watchlists (
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, product_id)
);

-- BIDS
CREATE TABLE IF NOT EXISTS bids (
  id SERIAL PRIMARY KEY,
  product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
  bidder_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  amount DECIMAL(15, 2) NOT NULL,
  max_amount DECIMAL(15, 2),
  is_auto_bid BOOLEAN DEFAULT FALSE,
  time TIMESTAMPTZ DEFAULT NOW(),
  status bid_status DEFAULT 'VALID'
);
CREATE INDEX IF NOT EXISTS idx_bids_product_id ON bids(product_id);
CREATE INDEX IF NOT EXISTS idx_bids_bidder_id ON bids(bidder_id);

-- BANNED BIDDERS
CREATE TABLE IF NOT EXISTS banned_bidders (
  id SERIAL PRIMARY KEY,
  product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  reason VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(product_id, user_id)
);

-- FEEDBACKS
CREATE TABLE IF NOT EXISTS feedbacks (
  id SERIAL PRIMARY KEY,
  product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
  from_user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  to_user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  score INTEGER CHECK (score IN (1, -1)),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- PRODUCT QUESTIONS
CREATE TABLE IF NOT EXISTS product_questions (
  id SERIAL PRIMARY KEY,
  product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  answer TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  answered_at TIMESTAMPTZ
);

-- CHAT MESSAGES
CREATE TABLE IF NOT EXISTS chat_messages (
  id SERIAL PRIMARY KEY,
  product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
  sender_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  receiver_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Triggers & Functions (Phần sửa lỗi quan trọng nhất)

-- A. Trigger cập nhật updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE OR REPLACE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE OR REPLACE TRIGGER update_categories_updated_at BEFORE UPDATE ON categories FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE OR REPLACE TRIGGER update_products_updated_at BEFORE UPDATE ON products FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- B. Trigger cập nhật search_vector (Thay thế cho GENERATED ALWAYS)
-- Hàm này sẽ chạy mỗi khi Insert hoặc Update bảng Product
CREATE OR REPLACE FUNCTION products_tsvector_trigger() RETURNS trigger AS $$
BEGIN
  -- Tạo vector từ tên sản phẩm, dùng unaccent để bỏ dấu
  NEW.search_vector := to_tsvector('simple', unaccent(NEW.name));
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

-- Gắn trigger vào bảng products
CREATE OR REPLACE TRIGGER tsvectorupdate 
BEFORE INSERT OR UPDATE ON products 
FOR EACH ROW EXECUTE PROCEDURE products_tsvector_trigger();