-- Migration 010: Add current_monthly_income and post_retirement_return_rate
-- to client_retirement_profile for more accurate savings-rate and corpus calculations.

ALTER TABLE client_retirement_profile
  ADD COLUMN IF NOT EXISTS current_monthly_income      numeric(12,2),
  ADD COLUMN IF NOT EXISTS post_retirement_return_rate numeric(5,4) DEFAULT 0.035;
