import dotenv from 'dotenv';
import { z } from 'zod';

// Load environment variables from .env if present
dotenv.config();

const EnvironmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(4000),
  PLATFORM_PORT: z.coerce.number().optional(),
  JWT_SECRET: z.string().min(8, 'JWT_SECRET must be at least 8 characters long').default('dayflow_hackathon_super_secret_jwt_key_2026!'),
  JWT_EXPIRES_IN: z.string().default('24h'),
  CORS_ORIGIN: z.string().default('*'),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(100),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(60000),
  WEBHOOK_SECRET: z.string().default('dayflow_webhook_signing_secret_xyz'),
  WEBHOOK_MAX_RETRIES: z.coerce.number().default(3),
  DATABASE_URL: z.string().optional().default('postgresql://postgres:postgres@localhost:5432/hr_core_db'),
  MEMBER1_HR_CORE_URL: z.string().url('MEMBER1_HR_CORE_URL must be a valid URL').default('http://localhost:8000'),
  MEMBER2_AI_ENGINE_URL: z.string().url('MEMBER2_AI_ENGINE_URL must be a valid URL').default('http://localhost:8000/api/v1/ai'),
});

export type PlatformConfig = z.infer<typeof EnvironmentSchema>;

class ConfigManager {
  private static instance: ConfigManager;
  private config: PlatformConfig;

  private constructor() {
    this.config = this.loadAndValidateConfig();
  }

  public static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }

  public getConfig(): PlatformConfig {
    return this.config;
  }

  public getEffectivePort(): number {
    return this.config.PLATFORM_PORT || this.config.PORT;
  }

  /**
   * Validates configuration with actionable diagnostic error reporting.
   * Prevents silent failures or misconfigurations during deployment.
   */
  public loadAndValidateConfig(): PlatformConfig {
    const rawEnv = {
      NODE_ENV: process.env.NODE_ENV,
      PORT: process.env.PORT || process.env.PLATFORM_PORT,
      PLATFORM_PORT: process.env.PLATFORM_PORT,
      JWT_SECRET: process.env.JWT_SECRET || process.env.JWT_SECRET_KEY,
      JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN,
      CORS_ORIGIN: process.env.CORS_ORIGIN,
      RATE_LIMIT_MAX_REQUESTS: process.env.RATE_LIMIT_MAX_REQUESTS,
      RATE_LIMIT_WINDOW_MS: process.env.RATE_LIMIT_WINDOW_MS,
      WEBHOOK_SECRET: process.env.WEBHOOK_SECRET,
      WEBHOOK_MAX_RETRIES: process.env.WEBHOOK_MAX_RETRIES,
      DATABASE_URL: process.env.DATABASE_URL,
      MEMBER1_HR_CORE_URL: process.env.MEMBER1_HR_CORE_URL,
      MEMBER2_AI_ENGINE_URL: process.env.MEMBER2_AI_ENGINE_URL,
    };

    const parseResult = EnvironmentSchema.safeParse(rawEnv);

    if (!parseResult.success) {
      const errorIssues = parseResult.error.issues.map(
        (issue) => `  - [${issue.path.join('.')}]: ${issue.message}`
      );
      const errorMessage = [
        '=================================================================',
        '🚨 FATAL CONFIGURATION ERROR: Invalid environment configuration',
        '=================================================================',
        ...errorIssues,
        '=================================================================',
        'Please check your .env file or environment variables before launching.',
      ].join('\n');

      console.error(errorMessage);
      throw new Error(`Configuration validation failed:\n${errorIssues.join('\n')}`);
    }

    return parseResult.data;
  }
}

export const platformConfig = ConfigManager.getInstance().getConfig();
export const configManager = ConfigManager.getInstance();
