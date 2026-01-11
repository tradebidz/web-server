-- Create ENUM types
CREATE TYPE bid_status AS ENUM ('VALID', 'REJECTED');
CREATE TYPE product_status AS ENUM ('ACTIVE', 'SOLD', 'EXPIRED', 'CANCELLED');
CREATE TYPE upgrade_status AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
CREATE TYPE user_role AS ENUM ('BIDDER', 'SELLER', 'ADMIN');
CREATE TYPE payment_status AS ENUM ('UNPAID', 'PAID', 'FAILED', 'REFUNDED');

-- Create categories table
CREATE TABLE categories (
  id SERIAL PRIMARY KEY,
  parent_id INTEGER,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ(6) DEFAULT NOW(),
  updated_at TIMESTAMPTZ(6) DEFAULT NOW(),
  FOREIGN KEY (parent_id) REFERENCES categories(id) ON UPDATE NO ACTION
);

-- Create users table
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  address TEXT,
  role user_role DEFAULT 'BIDDER',
  rating_score DOUBLE PRECISION DEFAULT 0,
  rating_count INTEGER DEFAULT 0,
  is_verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ(6) DEFAULT NOW(),
  updated_at TIMESTAMPTZ(6) DEFAULT NOW(),
  hashed_refresh_token TEXT,
  dob DATE
);

-- Create products table
CREATE TABLE products (
  id SERIAL PRIMARY KEY,
  seller_id INTEGER,
  category_id INTEGER,
  name VARCHAR(255) NOT NULL,
  thumbnail VARCHAR(255),
  description TEXT,
  start_price DECIMAL(15, 2) NOT NULL,
  current_price DECIMAL(15, 2) DEFAULT 0,
  step_price DECIMAL(15, 2) NOT NULL,
  buy_now_price DECIMAL(15, 2),
  start_time TIMESTAMPTZ(6) NOT NULL,
  end_time TIMESTAMPTZ(6) NOT NULL,
  is_auto_extend BOOLEAN DEFAULT TRUE,
  status product_status DEFAULT 'ACTIVE',
  winner_id INTEGER,
  view_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ(6) DEFAULT NOW(),
  updated_at TIMESTAMPTZ(6) DEFAULT NOW(),
  search_vector tsvector,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE RESTRICT ON UPDATE NO ACTION,
  FOREIGN KEY (seller_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE NO ACTION,
  FOREIGN KEY (winner_id) REFERENCES users(id) ON UPDATE NO ACTION
);

-- Create index for full-text search
CREATE INDEX idx_products_search ON products USING GIN(search_vector);

-- Create banned_bidders table
CREATE TABLE banned_bidders (
  id SERIAL PRIMARY KEY,
  product_id INTEGER,
  user_id INTEGER,
  reason VARCHAR(255),
  created_at TIMESTAMPTZ(6) DEFAULT NOW(),
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE ON UPDATE NO ACTION,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE NO ACTION,
  UNIQUE(product_id, user_id)
);

-- Create bids table
CREATE TABLE bids (
  id SERIAL PRIMARY KEY,
  product_id INTEGER,
  bidder_id INTEGER,
  amount DECIMAL(15, 2) NOT NULL,
  max_amount DECIMAL(15, 2),
  is_auto_bid BOOLEAN DEFAULT FALSE,
  time TIMESTAMPTZ(6) DEFAULT NOW(),
  status bid_status DEFAULT 'VALID',
  FOREIGN KEY (bidder_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE NO ACTION,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE ON UPDATE NO ACTION
);

-- Create indexes for bids
CREATE INDEX idx_bids_bidder_id ON bids(bidder_id);
CREATE INDEX idx_bids_product_id ON bids(product_id);

-- Create chat_messages table
CREATE TABLE chat_messages (
  id SERIAL PRIMARY KEY,
  product_id INTEGER,
  sender_id INTEGER,
  receiver_id INTEGER,
  content TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ(6) DEFAULT NOW(),
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE ON UPDATE NO ACTION,
  FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE NO ACTION,
  FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE NO ACTION
);

-- Create feedbacks table
CREATE TABLE feedbacks (
  id SERIAL PRIMARY KEY,
  product_id INTEGER,
  from_user_id INTEGER,
  to_user_id INTEGER,
  score INTEGER,
  comment TEXT,
  created_at TIMESTAMPTZ(6) DEFAULT NOW(),
  FOREIGN KEY (from_user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE NO ACTION,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE ON UPDATE NO ACTION,
  FOREIGN KEY (to_user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE NO ACTION
);

-- Create product_descriptions table
CREATE TABLE product_descriptions (
  id SERIAL PRIMARY KEY,
  product_id INTEGER,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ(6) DEFAULT NOW(),
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE ON UPDATE NO ACTION
);

-- Create product_images table
CREATE TABLE product_images (
  id SERIAL PRIMARY KEY,
  product_id INTEGER,
  url VARCHAR(255) NOT NULL,
  is_primary BOOLEAN DEFAULT FALSE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE ON UPDATE NO ACTION
);

-- Create product_questions table
CREATE TABLE product_questions (
  id SERIAL PRIMARY KEY,
  product_id INTEGER,
  user_id INTEGER,
  question TEXT NOT NULL,
  answer TEXT,
  created_at TIMESTAMPTZ(6) DEFAULT NOW(),
  answered_at TIMESTAMPTZ(6),
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE ON UPDATE NO ACTION,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE NO ACTION
);

-- Create upgrade_requests table
CREATE TABLE upgrade_requests (
  id SERIAL PRIMARY KEY,
  user_id INTEGER,
  reason TEXT,
  status upgrade_status DEFAULT 'PENDING',
  created_at TIMESTAMPTZ(6) DEFAULT NOW(),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE NO ACTION
);

-- Create watchlists table
CREATE TABLE watchlists (
  user_id INTEGER NOT NULL,
  product_id INTEGER NOT NULL,
  created_at TIMESTAMPTZ(6) DEFAULT NOW(),
  PRIMARY KEY (user_id, product_id),
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE ON UPDATE NO ACTION,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE NO ACTION
);

-- Create orders table
CREATE TABLE orders (
  id SERIAL PRIMARY KEY,
  product_id INTEGER UNIQUE NOT NULL,
  buyer_id INTEGER NOT NULL,
  seller_id INTEGER NOT NULL,
  amount DECIMAL(15, 2) NOT NULL,
  shipping_address TEXT,
  note TEXT,
  vnp_txn_ref TEXT UNIQUE,
  vnp_transaction_no TEXT,
  payment_status payment_status DEFAULT 'UNPAID',
  status VARCHAR(255) DEFAULT 'PENDING',
  payment_receipt_url VARCHAR(255),
  shipping_tracking_code VARCHAR(255),
  shipping_company VARCHAR(255),
  shipping_tracking_url VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  FOREIGN KEY (buyer_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE NO ACTION,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE ON UPDATE NO ACTION,
  FOREIGN KEY (seller_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE NO ACTION
);

-- Optional: Create a trigger to update updated_at timestamp automatically
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to tables with updated_at
CREATE TRIGGER update_categories_updated_at BEFORE UPDATE ON categories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();