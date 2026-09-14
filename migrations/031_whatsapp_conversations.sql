-- WhatsApp Conversations Migration
-- This migration creates the table for tracking WhatsApp conversation states

CREATE TABLE IF NOT EXISTS whatsapp_conversations (
  conversation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number VARCHAR(20) NOT NULL,
  state VARCHAR(50) NOT NULL DEFAULT 'initial',
  language VARCHAR(10) NOT NULL DEFAULT 'english',
  conversation_data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_phone_number ON whatsapp_conversations(phone_number);
CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_state ON whatsapp_conversations(state);
CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_created_at ON whatsapp_conversations(created_at DESC);

-- Add trigger to update updated_at
CREATE OR REPLACE FUNCTION update_whatsapp_conversation_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_whatsapp_conversation_updated_at ON whatsapp_conversations;
CREATE TRIGGER trigger_update_whatsapp_conversation_updated_at
  BEFORE UPDATE ON whatsapp_conversations
  FOR EACH ROW
  EXECUTE FUNCTION update_whatsapp_conversation_updated_at();

COMMENT ON TABLE whatsapp_conversations IS 'WhatsApp conversation state tracking for automated ordering';
