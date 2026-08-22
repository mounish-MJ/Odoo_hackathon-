-- DAYFLOW Member 2 — AI Engine Schema Migration
-- Enables pgvector extension and creates policy vector tables

-- Enable Vector Extension
CREATE EXTENSION IF NOT EXISTS vector;

-- 1. HR Policies Catalog
CREATE TABLE IF NOT EXISTS hr_policies (
  policy_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  category VARCHAR(50) NOT NULL DEFAULT 'LEAVE',
  content TEXT NOT NULL,
  version VARCHAR(20) NOT NULL DEFAULT '1.0',
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  access_roles TEXT[] DEFAULT '{"EMPLOYEE","MANAGER","HR_ADMIN"}',
  effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Policy Chunks & Vector Embeddings
CREATE TABLE IF NOT EXISTS policy_chunks (
  chunk_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id UUID NOT NULL REFERENCES hr_policies(policy_id) ON DELETE CASCADE,
  chunk_index INT NOT NULL,
  section VARCHAR(255),
  content TEXT NOT NULL,
  embedding vector(1536), -- OpenAI text-embedding-3-small vector
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- HNSW Vector Index for fast Cosine Distance lookup
CREATE INDEX IF NOT EXISTS idx_policy_chunks_embedding 
ON policy_chunks 
USING hnsw (embedding vector_cosine_ops);

-- 3. AI Conversations
CREATE TABLE IF NOT EXISTS ai_conversations (
  conversation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. AI Messages Audit Log
CREATE TABLE IF NOT EXISTS ai_messages (
  message_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES ai_conversations(conversation_id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL, -- USER, ASSISTANT, SYSTEM, TOOL
  content TEXT NOT NULL,
  intent VARCHAR(50),
  context_used JSONB,
  citations JSONB,
  tool_calls JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
