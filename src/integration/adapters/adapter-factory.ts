import { IHRCoreService } from '../../contracts/hr-core.contract';
import { IAIEngineService } from '../../contracts/ai-engine.contract';
import { MockHRCoreService } from '../../mocks/mock-hr-core';
import { MockAIEngineService } from '../../mocks/mock-ai-engine';
import { HttpHRCoreService } from './http-hr-core.adapter';
import { HttpAIEngineService } from './http-ai-engine.adapter';

export type IntegrationMode = 'MOCK' | 'HTTP_LIVE';

export class AdapterFactory {
  public static createHRCoreService(mode?: IntegrationMode): IHRCoreService {
    const activeMode =
      mode || (process.env.INTEGRATION_MODE === 'HTTP_LIVE' ? 'HTTP_LIVE' : 'MOCK');

    if (activeMode === 'HTTP_LIVE') {
      return new HttpHRCoreService(process.env.MEMBER1_HR_CORE_URL);
    }
    return new MockHRCoreService();
  }

  public static createAIEngineService(mode?: IntegrationMode): IAIEngineService {
    const activeMode =
      mode || (process.env.INTEGRATION_MODE === 'HTTP_LIVE' ? 'HTTP_LIVE' : 'MOCK');

    if (activeMode === 'HTTP_LIVE') {
      return new HttpAIEngineService(process.env.MEMBER2_AI_ENGINE_URL);
    }
    return new MockAIEngineService();
  }
}
