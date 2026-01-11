-- Migration: Add payment receipt and shipping tracking fields to orders table
-- Run this migration to add the new fields for order completion wizard

-- Add new columns to orders table
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS payment_receipt_url VARCHAR(255),
ADD COLUMN IF NOT EXISTS shipping_tracking_code VARCHAR(255),
ADD COLUMN IF NOT EXISTS shipping_company VARCHAR(255),
ADD COLUMN IF NOT EXISTS shipping_tracking_url VARCHAR(255);

-- Add comments for documentation
COMMENT ON COLUMN orders.payment_receipt_url IS 'URL of the payment receipt image uploaded by buyer';
COMMENT ON COLUMN orders.shipping_tracking_code IS 'Shipping tracking code provided by seller';
COMMENT ON COLUMN orders.shipping_company IS 'Name of the shipping company';
COMMENT ON COLUMN orders.shipping_tracking_url IS 'URL of the shipping tracking document image uploaded by seller';
