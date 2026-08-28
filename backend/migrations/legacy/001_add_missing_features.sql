-- ============================================
-- DynoPay Missing Features - Database Migration
-- Date: 2026-01-25
-- Purpose: Add tables for Referral System, Knowledge Base, 2FA, Sessions, and enhancements
-- ============================================

-- ============================================
-- 1. REFERRAL SYSTEM
-- ============================================

-- Add referral fields to existing user table
ALTER TABLE tbl_user 
ADD COLUMN IF NOT EXISTS referral_code VARCHAR(50) UNIQUE,
ADD COLUMN IF NOT EXISTS referred_by_code VARCHAR(50),
ADD COLUMN IF NOT EXISTS referral_bonus_earned DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS referral_count INTEGER DEFAULT 0;

-- Create referral tracking table
CREATE TABLE IF NOT EXISTS tbl_referral (
  referral_id SERIAL PRIMARY KEY,
  referrer_user_id INTEGER NOT NULL REFERENCES tbl_user(user_id) ON DELETE CASCADE,
  referred_user_id INTEGER NOT NULL REFERENCES tbl_user(user_id) ON DELETE CASCADE,
  referral_code VARCHAR(50) NOT NULL,
  status VARCHAR(50) DEFAULT 'pending', -- pending, active, rewarded, expired
  activation_requirement VARCHAR(100) DEFAULT 'first_transaction_100',
  bonus_amount DECIMAL(10,2),
  bonus_currency VARCHAR(10) DEFAULT 'USD',
  referee_discount_percent DECIMAL(5,2) DEFAULT 50.00,
  referee_discount_duration_days INTEGER DEFAULT 30,
  referred_at TIMESTAMP DEFAULT NOW(),
  activated_at TIMESTAMP,
  rewarded_at TIMESTAMP,
  expires_at TIMESTAMP,
  notes TEXT,
  "createdAt" TIMESTAMP DEFAULT NOW(),
  "updatedAt" TIMESTAMP DEFAULT NOW(),
  UNIQUE(referrer_user_id, referred_user_id)
);

-- Create referral rewards history table
CREATE TABLE IF NOT EXISTS tbl_referral_reward (
  reward_id SERIAL PRIMARY KEY,
  referral_id INTEGER NOT NULL REFERENCES tbl_referral(referral_id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES tbl_user(user_id) ON DELETE CASCADE,
  reward_type VARCHAR(50) NOT NULL, -- bonus_credit, discount, commission
  amount DECIMAL(10,2) NOT NULL,
  currency VARCHAR(10) DEFAULT 'USD',
  status VARCHAR(50) DEFAULT 'pending', -- pending, credited, withdrawn
  transaction_id VARCHAR(255),
  credited_at TIMESTAMP,
  withdrawn_at TIMESTAMP,
  "createdAt" TIMESTAMP DEFAULT NOW(),
  "updatedAt" TIMESTAMP DEFAULT NOW()
);

-- Indexes for referral tables
CREATE INDEX IF NOT EXISTS idx_referral_referrer ON tbl_referral(referrer_user_id);
CREATE INDEX IF NOT EXISTS idx_referral_referred ON tbl_referral(referred_user_id);
CREATE INDEX IF NOT EXISTS idx_referral_code ON tbl_referral(referral_code);
CREATE INDEX IF NOT EXISTS idx_referral_status ON tbl_referral(status);

-- ============================================
-- 2. KNOWLEDGE BASE SYSTEM
-- ============================================

CREATE TABLE IF NOT EXISTS tbl_kb_category (
  category_id SERIAL PRIMARY KEY,
  category_name VARCHAR(255) NOT NULL,
  category_slug VARCHAR(255) UNIQUE NOT NULL,
  category_icon VARCHAR(100),
  description TEXT,
  parent_category_id INTEGER REFERENCES tbl_kb_category(category_id) ON DELETE SET NULL,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  article_count INTEGER DEFAULT 0,
  "createdAt" TIMESTAMP DEFAULT NOW(),
  "updatedAt" TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tbl_kb_article (
  article_id SERIAL PRIMARY KEY,
  category_id INTEGER REFERENCES tbl_kb_category(category_id) ON DELETE SET NULL,
  title VARCHAR(500) NOT NULL,
  slug VARCHAR(500) UNIQUE NOT NULL,
  excerpt TEXT,
  content TEXT NOT NULL,
  content_html TEXT,
  author_id INTEGER REFERENCES tbl_user(user_id) ON DELETE SET NULL,
  featured_image_url VARCHAR(500),
  views_count INTEGER DEFAULT 0,
  helpful_count INTEGER DEFAULT 0,
  not_helpful_count INTEGER DEFAULT 0,
  is_published BOOLEAN DEFAULT false,
  published_at TIMESTAMP,
  meta_title VARCHAR(255),
  meta_description TEXT,
  meta_keywords TEXT,
  reading_time_minutes INTEGER,
  "createdAt" TIMESTAMP DEFAULT NOW(),
  "updatedAt" TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tbl_kb_article_tag (
  tag_id SERIAL PRIMARY KEY,
  article_id INTEGER NOT NULL REFERENCES tbl_kb_article(article_id) ON DELETE CASCADE,
  tag_name VARCHAR(100) NOT NULL,
  "createdAt" TIMESTAMP DEFAULT NOW(),
  UNIQUE(article_id, tag_name)
);

CREATE TABLE IF NOT EXISTS tbl_kb_article_feedback (
  feedback_id SERIAL PRIMARY KEY,
  article_id INTEGER NOT NULL REFERENCES tbl_kb_article(article_id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES tbl_user(user_id) ON DELETE SET NULL,
  is_helpful BOOLEAN NOT NULL,
  feedback_text TEXT,
  user_ip VARCHAR(50),
  "createdAt" TIMESTAMP DEFAULT NOW()
);

-- Indexes for knowledge base
CREATE INDEX IF NOT EXISTS idx_kb_article_category ON tbl_kb_article(category_id);
CREATE INDEX IF NOT EXISTS idx_kb_article_slug ON tbl_kb_article(slug);
CREATE INDEX IF NOT EXISTS idx_kb_article_published ON tbl_kb_article(is_published, published_at);
CREATE INDEX IF NOT EXISTS idx_kb_article_views ON tbl_kb_article(views_count DESC);

-- Full-text search index for articles
CREATE INDEX IF NOT EXISTS idx_kb_article_search ON tbl_kb_article USING gin(to_tsvector('english', title || ' ' || content));

-- ============================================
-- 3. TWO-FACTOR AUTHENTICATION (2FA)
-- ============================================

CREATE TABLE IF NOT EXISTS tbl_user_2fa (
  id SERIAL PRIMARY KEY,
  user_id INTEGER UNIQUE NOT NULL REFERENCES tbl_user(user_id) ON DELETE CASCADE,
  secret TEXT NOT NULL,
  is_enabled BOOLEAN DEFAULT false,
  backup_codes TEXT[], -- Array of hashed backup codes
  method VARCHAR(50) DEFAULT 'totp', -- totp, sms, email
  phone_number VARCHAR(50),
  enabled_at TIMESTAMP,
  last_used_at TIMESTAMP,
  failed_attempts INTEGER DEFAULT 0,
  locked_until TIMESTAMP,
  "createdAt" TIMESTAMP DEFAULT NOW(),
  "updatedAt" TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- 4. SESSION MANAGEMENT
-- ============================================

CREATE TABLE IF NOT EXISTS tbl_user_session (
  session_id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES tbl_user(user_id) ON DELETE CASCADE,
  session_token TEXT UNIQUE NOT NULL,
  refresh_token TEXT UNIQUE,
  ip_address VARCHAR(50),
  user_agent TEXT,
  device_type VARCHAR(50), -- desktop, mobile, tablet
  device_name VARCHAR(255),
  browser VARCHAR(100),
  os VARCHAR(100),
  location VARCHAR(255),
  is_active BOOLEAN DEFAULT true,
  last_activity TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL,
  revoked_at TIMESTAMP,
  revoke_reason VARCHAR(255)
);

-- Indexes for sessions
CREATE INDEX IF NOT EXISTS idx_session_user ON tbl_user_session(user_id);
CREATE INDEX IF NOT EXISTS idx_session_token ON tbl_user_session(session_token);
CREATE INDEX IF NOT EXISTS idx_session_active ON tbl_user_session(is_active, expires_at);

-- ============================================
-- 5. LOGIN HISTORY & SECURITY LOGS
-- ============================================

CREATE TABLE IF NOT EXISTS tbl_login_history (
  history_id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES tbl_user(user_id) ON DELETE CASCADE,
  email VARCHAR(255),
  login_at TIMESTAMP DEFAULT NOW(),
  ip_address VARCHAR(50),
  user_agent TEXT,
  device_type VARCHAR(50),
  browser VARCHAR(100),
  os VARCHAR(100),
  location VARCHAR(255),
  login_method VARCHAR(50), -- password, google, facebook, telegram, 2fa
  status VARCHAR(50) NOT NULL, -- success, failed, blocked, suspicious
  failure_reason VARCHAR(255),
  requires_2fa BOOLEAN DEFAULT false,
  "createdAt" TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tbl_security_log (
  log_id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES tbl_user(user_id) ON DELETE CASCADE,
  event_type VARCHAR(100) NOT NULL, -- password_change, email_change, 2fa_enabled, api_key_created, etc.
  event_description TEXT,
  ip_address VARCHAR(50),
  user_agent TEXT,
  status VARCHAR(50) DEFAULT 'success',
  metadata JSONB,
  "createdAt" TIMESTAMP DEFAULT NOW()
);

-- Indexes for security logs
CREATE INDEX IF NOT EXISTS idx_login_history_user ON tbl_login_history(user_id);
CREATE INDEX IF NOT EXISTS idx_login_history_status ON tbl_login_history(status, login_at);
CREATE INDEX IF NOT EXISTS idx_security_log_user ON tbl_security_log(user_id);
CREATE INDEX IF NOT EXISTS idx_security_log_type ON tbl_security_log(event_type, "createdAt");

-- ============================================
-- 6. ENHANCED API KEY MANAGEMENT
-- ============================================

-- Add new columns to existing tbl_api table
ALTER TABLE tbl_api
ADD COLUMN IF NOT EXISTS admin_token TEXT,
ADD COLUMN IF NOT EXISTS ip_whitelist TEXT[], -- Array of allowed IPs
ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS request_count BIGINT DEFAULT 0,
ADD COLUMN IF NOT EXISTS rate_limit_per_minute INTEGER DEFAULT 60,
ADD COLUMN IF NOT EXISTS rate_limit_per_hour INTEGER DEFAULT 3600,
ADD COLUMN IF NOT EXISTS rate_limit_per_day INTEGER DEFAULT 100000,
ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '{"payments": true, "wallets": true, "transactions": true}'::jsonb,
ADD COLUMN IF NOT EXISTS webhook_url VARCHAR(500),
ADD COLUMN IF NOT EXISTS webhook_secret TEXT,
ADD COLUMN IF NOT EXISTS notes TEXT,
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP;

-- API usage logs table
CREATE TABLE IF NOT EXISTS tbl_api_usage_log (
  log_id SERIAL PRIMARY KEY,
  api_id INTEGER REFERENCES tbl_api(api_id) ON DELETE CASCADE,
  company_id INTEGER REFERENCES tbl_company(company_id) ON DELETE CASCADE,
  endpoint VARCHAR(500) NOT NULL,
  method VARCHAR(10) NOT NULL,
  status_code INTEGER,
  ip_address VARCHAR(50),
  user_agent TEXT,
  request_body JSONB,
  response_body JSONB,
  error_message TEXT,
  request_time TIMESTAMP DEFAULT NOW(),
  response_time_ms INTEGER,
  "createdAt" TIMESTAMP DEFAULT NOW()
);

-- API rate limiting tracker
CREATE TABLE IF NOT EXISTS tbl_api_rate_limit (
  id SERIAL PRIMARY KEY,
  api_id INTEGER NOT NULL REFERENCES tbl_api(api_id) ON DELETE CASCADE,
  time_window VARCHAR(20) NOT NULL, -- minute, hour, day
  window_start TIMESTAMP NOT NULL,
  request_count INTEGER DEFAULT 0,
  last_request_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(api_id, time_window, window_start)
);

-- Indexes for API tables
CREATE INDEX IF NOT EXISTS idx_api_usage_log_api ON tbl_api_usage_log(api_id);
CREATE INDEX IF NOT EXISTS idx_api_usage_log_company ON tbl_api_usage_log(company_id);
CREATE INDEX IF NOT EXISTS idx_api_usage_log_time ON tbl_api_usage_log(request_time);
CREATE INDEX IF NOT EXISTS idx_api_rate_limit_window ON tbl_api_rate_limit(api_id, time_window, window_start);

-- ============================================
-- 7. USER PREFERENCES & SETTINGS
-- ============================================

CREATE TABLE IF NOT EXISTS tbl_user_preference (
  preference_id SERIAL PRIMARY KEY,
  user_id INTEGER UNIQUE NOT NULL REFERENCES tbl_user(user_id) ON DELETE CASCADE,
  language VARCHAR(10) DEFAULT 'en',
  timezone VARCHAR(100) DEFAULT 'UTC',
  currency_display VARCHAR(10) DEFAULT 'USD',
  date_format VARCHAR(50) DEFAULT 'MM/DD/YYYY',
  time_format VARCHAR(10) DEFAULT '12h', -- 12h or 24h
  theme VARCHAR(20) DEFAULT 'light', -- light, dark, auto
  email_notifications BOOLEAN DEFAULT true,
  sms_notifications BOOLEAN DEFAULT false,
  push_notifications BOOLEAN DEFAULT true,
  marketing_emails BOOLEAN DEFAULT true,
  security_alerts BOOLEAN DEFAULT true,
  transaction_alerts BOOLEAN DEFAULT true,
  "createdAt" TIMESTAMP DEFAULT NOW(),
  "updatedAt" TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- 8. PROFILE PICTURE STORAGE
-- ============================================

CREATE TABLE IF NOT EXISTS tbl_user_media (
  media_id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES tbl_user(user_id) ON DELETE CASCADE,
  media_type VARCHAR(50) NOT NULL, -- profile_picture, document, attachment
  file_name VARCHAR(255) NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  file_url VARCHAR(500),
  file_size INTEGER,
  mime_type VARCHAR(100),
  width INTEGER,
  height INTEGER,
  is_active BOOLEAN DEFAULT true,
  uploaded_at TIMESTAMP DEFAULT NOW(),
  "createdAt" TIMESTAMP DEFAULT NOW(),
  "updatedAt" TIMESTAMP DEFAULT NOW()
);

-- Index for user media
CREATE INDEX IF NOT EXISTS idx_user_media_user ON tbl_user_media(user_id);
CREATE INDEX IF NOT EXISTS idx_user_media_type ON tbl_user_media(media_type);

-- ============================================
-- 9. TRIGGERS & FUNCTIONS
-- ============================================

-- Function to update article count in categories
CREATE OR REPLACE FUNCTION update_category_article_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE tbl_kb_category 
    SET article_count = article_count + 1 
    WHERE category_id = NEW.category_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE tbl_kb_category 
    SET article_count = article_count - 1 
    WHERE category_id = OLD.category_id;
  ELSIF TG_OP = 'UPDATE' AND OLD.category_id != NEW.category_id THEN
    UPDATE tbl_kb_category 
    SET article_count = article_count - 1 
    WHERE category_id = OLD.category_id;
    UPDATE tbl_kb_category 
    SET article_count = article_count + 1 
    WHERE category_id = NEW.category_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for article count
DROP TRIGGER IF EXISTS trg_update_article_count ON tbl_kb_article;
CREATE TRIGGER trg_update_article_count
AFTER INSERT OR UPDATE OR DELETE ON tbl_kb_article
FOR EACH ROW EXECUTE FUNCTION update_category_article_count();

-- Function to update user referral count
CREATE OR REPLACE FUNCTION update_referral_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE tbl_user 
    SET referral_count = referral_count + 1 
    WHERE user_id = NEW.referrer_user_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE tbl_user 
    SET referral_count = referral_count - 1 
    WHERE user_id = OLD.referrer_user_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for referral count
DROP TRIGGER IF EXISTS trg_update_referral_count ON tbl_referral;
CREATE TRIGGER trg_update_referral_count
AFTER INSERT OR DELETE ON tbl_referral
FOR EACH ROW EXECUTE FUNCTION update_referral_count();

-- ============================================
-- 10. SAMPLE DATA (Optional - for testing)
-- ============================================

-- Insert default KB categories
INSERT INTO tbl_kb_category (category_name, category_slug, category_icon, display_order) VALUES
('Getting Started', 'getting-started', '🚀', 1),
('API Integration', 'api-integration', '🔧', 2),
('Payments & Transactions', 'payments-transactions', '💳', 3),
('Security & Compliance', 'security-compliance', '🔐', 4),
('Account Management', 'account-management', '💼', 5),
('FAQ', 'faq', '❓', 6)
ON CONFLICT (category_slug) DO NOTHING;

-- ============================================
-- MIGRATION COMPLETE
-- ============================================

-- Display summary
SELECT 'Migration completed successfully!' AS status;
SELECT COUNT(*) AS referral_table_ready FROM information_schema.tables WHERE table_name = 'tbl_referral';
SELECT COUNT(*) AS kb_tables_ready FROM information_schema.tables WHERE table_name LIKE 'tbl_kb_%';
SELECT COUNT(*) AS security_tables_ready FROM information_schema.tables WHERE table_name IN ('tbl_user_2fa', 'tbl_user_session', 'tbl_login_history');
