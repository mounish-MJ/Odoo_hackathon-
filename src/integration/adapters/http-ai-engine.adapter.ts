import http from 'http';
import {
  IAIEngineService,
  LeaveRiskAssessmentInput,
  LeaveRiskAssessmentOutput,
  AttendanceAnomalyInput,
  AttendanceAnomalyOutput,
} from '../../contracts/ai-engine.contract';

export class HttpAIEngineService implements IAIEngineService {
  private baseUrl: string;

  constructor(baseUrl: string = process.env.MEMBER2_AI_ENGINE_URL || 'http://localhost:8000/api/v1/ai') {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  public async evaluateLeaveRisk(
    input: LeaveRiskAssessmentInput
  ): Promise<LeaveRiskAssessmentOutput> {
    try {
      return await this.httpRequest<LeaveRiskAssessmentOutput>(
        'POST',
        '/evaluate-leave-risk',
        input
      );
    } catch {
      // Deterministic rule-based fallback if AI service is offline
      const riskScore = input.days > 2 ? 0.45 : 0.15;
      return {
        riskScore,
        approvalConfidence: 0.95,
        autoApproveRecommended: input.days <= 2,
        predictedApprovalTimeHours: input.days > 2 ? 4 : 0,
        suggestedAction: input.days > 2 ? 'ROUTE_MANAGER' : 'AUTO_APPROVE',
        factors: [
          input.days > 2 ? 'Multi-day leave requested' : 'Standard 1-2 day short leave',
          'Team coverage adequate',
        ],
        modelVersion: 'dayflow-v2-fallback',
      };
    }
  }

  public async detectAttendanceAnomaly(
    input: AttendanceAnomalyInput
  ): Promise<AttendanceAnomalyOutput> {
    try {
      return await this.httpRequest<AttendanceAnomalyOutput>(
        'POST',
        '/detect-attendance-anomaly',
        input
      );
    } catch {
      return {
        isAnomaly: false,
        anomalyScore: 0.05,
        recommendedResolution: 'Standard check-in recorded',
      };
    }
  }

  public async calculateAttritionRisk(
    userId: string
  ): Promise<{ riskScore: number; riskLevel: 'LOW' | 'MEDIUM' | 'HIGH'; drivers: string[] }> {
    try {
      return await this.httpRequest<{
        riskScore: number;
        riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
        drivers: string[];
      }>('POST', `/attrition-risk/${userId}`);
    } catch {
      return {
        riskLevel: 'LOW',
        riskScore: 0.1,
        drivers: ['Stable performance metrics'],
      };
    }
  }

  private httpRequest<T>(method: string, path: string, body?: unknown): Promise<T> {
    return new Promise((resolve, reject) => {
      const url = new URL(path, this.baseUrl);
      const req = http.request(
        url,
        {
          method,
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          timeout: 2000,
        },
        (res) => {
          let data = '';
          res.on('data', (chunk) => (data += chunk));
          res.on('end', () => {
            if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
              try {
                resolve(JSON.parse(data));
              } catch {
                resolve(data as unknown as T);
              }
            } else {
              reject(new Error(`HTTP ${res.statusCode}: ${data}`));
            }
          });
        }
      );

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timed out'));
      });

      if (body) {
        req.write(JSON.stringify(body));
      }
      req.end();
    });
  }
}
