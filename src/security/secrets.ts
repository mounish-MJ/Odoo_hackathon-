import dotenv from 'dotenv';
dotenv.config();

const SECRETS_REGISTRY: Record<string, string> = {
  JWT_SECRET: process.env.JWT_SECRET || 'dayflow_hackathon_super_secret_jwt_key_2026!',
  WEBHOOK_SECRET: process.env.WEBHOOK_SECRET || 'dayflow_webhook_signing_secret_xyz',
  SESSION_SECRET: process.env.SESSION_SECRET || 'dayflow_session_secret_secure_string',
};

/**
 * Retrieves a secret securely from environment or registry without leaking into logs.
 */
export function getSecret(key: string): string {
  const value = process.env[key] || SECRETS_REGISTRY[key];
  if (!value) {
    throw new Error(`Required secret '${key}' is not configured`);
  }
  return value;
}

/**
 * Checks if a given string contains any registered secrets.
 */
export function containsSecret(target: string): boolean {
  if (!target || typeof target !== 'string') return false;
  for (const secret of Object.values(SECRETS_REGISTRY)) {
    if (secret && secret.length > 5 && target.includes(secret)) {
      return true;
    }
  }
  return false;
}
