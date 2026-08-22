import request from 'supertest';
import { createApp } from '../src/server';
import { AuthSecurityService } from '../src/security/auth.middleware';
import { Role } from '../src/contracts/authorization.contract';
import { Express } from 'express';

describe('Member 4 Integration API Endpoints Tests', () => {
  let app: Express;
  let employeeToken: string;
  let managerToken: string;
  let adminToken: string;

  beforeAll(() => {
    app = createApp();

    employeeToken = AuthSecurityService.generateToken({
      userId: 'user_123',
      name: 'John Doe',
      email: 'john@dayflow.app',
      role: Role.EMPLOYEE,
      reportingManagerId: 'mgr_456',
    });

    managerToken = AuthSecurityService.generateToken({
      userId: 'mgr_456',
      name: 'Manager Bob',
      email: 'bob@dayflow.app',
      role: Role.MANAGER,
    });

    adminToken = AuthSecurityService.generateToken({
      userId: 'admin_001',
      name: 'Admin Carol',
      email: 'carol@dayflow.app',
      role: Role.ADMIN,
    });
  });

  test('1. GET /health returns HEALTHY status', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('HEALTHY');
  });

  test('2. POST /api/v1/leaves/apply triggers orchestration and auto-approves 2-day leave', async () => {
    const res = await request(app)
      .post('/api/v1/leaves/apply')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({
        leaveTypeId: 'PAID',
        startDate: '2026-09-01',
        endDate: '2026-09-02',
        days: 2,
        reason: 'Personal holiday',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.approvalStatus).toBe('AUTO_APPROVED');
    expect(res.body.data.output.status).toBe('APPROVED');
  });

  test('3. POST /api/v1/leaves/apply routes 5-day leave to manager approval', async () => {
    const res = await request(app)
      .post('/api/v1/leaves/apply')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({
        leaveTypeId: 'PAID',
        startDate: '2026-09-10',
        endDate: '2026-09-15',
        days: 5,
        reason: 'Family vacation',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.approvalStatus).toBe('PENDING');
    expect(res.body.data.approvalId).toBeDefined();

    const approvalId = res.body.data.approvalId;

    // Manager checks pending approvals
    const pendingRes = await request(app)
      .get('/api/v1/approvals/pending')
      .set('Authorization', `Bearer ${managerToken}`);

    expect(pendingRes.status).toBe(200);
    expect(pendingRes.body.data.some((a: any) => a.approvalId === approvalId)).toBe(true);

    // Manager approves
    const decideRes = await request(app)
      .post(`/api/v1/approvals/${approvalId}/decide`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        decision: 'APPROVED',
        comments: 'Enjoy your vacation!',
      });

    expect(decideRes.status).toBe(200);
    expect(decideRes.body.success).toBe(true);
    expect(decideRes.body.data.output.status).toBe('APPROVED');
  });

  test('4. GET /api/v1/audit/logs allows Admin to view audit records', async () => {
    const res = await request(app)
      .get('/api/v1/audit/logs')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  test('5. Non-admin is forbidden from viewing audit logs', async () => {
    const res = await request(app)
      .get('/api/v1/audit/logs')
      .set('Authorization', `Bearer ${employeeToken}`);

    expect(res.status).toBe(403);
  });
});
