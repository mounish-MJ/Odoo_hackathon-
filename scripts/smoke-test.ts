/**
 * DAYFLOW — Member 4 Automated Platform Smoke Test Script
 * Verifies all 10 deployment criteria in a single execution.
 */

import request from 'supertest';
import { v4 as uuidv4 } from 'uuid';
import { createApp } from '../src/server';
import { AuthSecurityService } from '../src/security/auth.middleware';
import { Role } from '../src/contracts/authorization.contract';
import { PlatformEventBus } from '../src/orchestration/event-bus';
import { EventIngestionService } from '../src/orchestration/event-ingestion.service';
import { ApprovalRouter } from '../src/orchestration/approval-router';
import { AuditService } from '../src/audit/audit.service';
import { NotificationService } from '../src/notifications/notification.service';
import { StandardEventType } from '../src/contracts/event.contract';
import { NotificationChannel } from '../src/contracts/notification.contract';

async function runSmokeTests() {
  console.log('=================================================================');
  console.log('🧪 DAYFLOW Member 4 — Deployment Smoke Test Verification');
  console.log('=================================================================');

  const app = createApp();
  let passedCount = 0;
  let failedCount = 0;

  function recordResult(step: number, title: string, success: boolean, detail?: string) {
    if (success) {
      console.log(`✅ [Step ${step}/10] ${title}: PASSED`);
      if (detail) console.log(`   └─ ${detail}`);
      passedCount++;
    } else {
      console.error(`❌ [Step ${step}/10] ${title}: FAILED`);
      if (detail) console.error(`   └─ Error: ${detail}`);
      failedCount++;
    }
  }

  // -------------------------------------------------------------
  // 1. Application Starts & Liveness Probe
  // -------------------------------------------------------------
  try {
    const res = await request(app).get('/health');
    const isHealthy = res.status === 200 && res.body.status === 'HEALTHY';
    recordResult(1, 'Application Starts & Liveness Check', isHealthy, `Status: ${res.body.status}`);
  } catch (err: any) {
    recordResult(1, 'Application Starts & Liveness Check', false, err.message);
  }

  // -------------------------------------------------------------
  // 2. Database Connection / Readiness Probe
  // -------------------------------------------------------------
  try {
    const res = await request(app).get('/ready');
    const isReady = res.status === 200 && (res.body.status === 'HEALTHY' || res.body.status === 'DEGRADED');
    recordResult(2, 'Database Connection & Readiness Check', isReady, `DB Type: ${res.body.subsystems?.database?.details?.type}`);
  } catch (err: any) {
    recordResult(2, 'Database Connection & Readiness Check', false, err.message);
  }

  // -------------------------------------------------------------
  // 3. Authentication (JWT Issue & Verification)
  // -------------------------------------------------------------
  let employeeToken = '';
  let managerToken = '';
  let hrToken = '';
  try {
    employeeToken = AuthSecurityService.generateToken({
      userId: 'emp_smoke_001',
      name: 'Smoke Employee',
      email: 'smoke.emp@dayflow.app',
      role: Role.EMPLOYEE,
      reportingManagerId: 'mgr_smoke_001',
    });

    managerToken = AuthSecurityService.generateToken({
      userId: 'mgr_smoke_001',
      name: 'Smoke Manager',
      email: 'smoke.mgr@dayflow.app',
      role: Role.MANAGER,
    });

    hrToken = AuthSecurityService.generateToken({
      userId: 'hr_smoke_001',
      name: 'Smoke HR Admin',
      email: 'smoke.hr@dayflow.app',
      role: Role.HR,
    });

    const payload = AuthSecurityService.verifyToken(employeeToken);
    const authWorks = payload.userId === 'emp_smoke_001' && payload.role === Role.EMPLOYEE;
    recordResult(3, 'Authentication & JWT Verification', authWorks, `Authenticated as: ${payload.name}`);
  } catch (err: any) {
    recordResult(3, 'Authentication & JWT Verification', false, err.message);
  }

  // -------------------------------------------------------------
  // 4. Authorization & RBAC Checks
  // -------------------------------------------------------------
  try {
    // Employee attempting audit query (should return 403 Forbidden)
    const empAuditRes = await request(app)
      .get('/api/v1/audit/logs')
      .set('Authorization', `Bearer ${employeeToken}`);

    // HR Admin attempting audit query (should return 200 OK)
    const hrAuditRes = await request(app)
      .get('/api/v1/audit/logs')
      .set('Authorization', `Bearer ${hrToken}`);

    const rbacWorks = empAuditRes.status === 403 && hrAuditRes.status === 200;
    recordResult(4, 'Role-Based Access Control (RBAC)', rbacWorks, `Forbidden: 403, Allowed: 200`);
  } catch (err: any) {
    recordResult(4, 'Role-Based Access Control (RBAC)', false, err.message);
  }

  // -------------------------------------------------------------
  // 5. Event Processing & Event Bus
  // -------------------------------------------------------------
  try {
    const eventBus = PlatformEventBus.getInstance();
    let eventReceived = false;

    eventBus.subscribe(StandardEventType.EMPLOYEE_UPDATED, (_e) => {
      eventReceived = true;
    });

    const ingestion = EventIngestionService.getInstance(eventBus);
    await ingestion.publishDomainEvent({
      eventType: StandardEventType.EMPLOYEE_UPDATED,
      resourceType: 'employee',
      resourceId: 'emp_smoke_001',
      actor: { userId: 'hr_smoke_001', role: Role.HR },
      payload: { departmentId: 'engineering' },
      correlationId: 'trace_smoke_event',
    });

    await new Promise((resolve) => setTimeout(resolve, 50));
    recordResult(5, 'Event Processing & Event Bus Delivery', eventReceived, 'Subscribed & Dispatched');
  } catch (err: any) {
    recordResult(5, 'Event Processing & Event Bus Delivery', false, err.message);
  }

  // -------------------------------------------------------------
  // 6. Workflow Processing (8-Step Engine)
  // -------------------------------------------------------------
  let autoApprovedWorkflowId = '';
  try {
    // 2-day leave auto-approves and runs all 8 steps
    const wfRes = await request(app)
      .post('/api/v1/leaves/apply')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({
        leaveTypeId: 'PAID',
        startDate: '2026-09-01',
        endDate: '2026-09-02',
        days: 2,
        reason: 'Smoke test auto-approve workflow',
      });

    autoApprovedWorkflowId = wfRes.body.data?.workflowId;
    const wfSuccess = wfRes.status === 201 && wfRes.body.data?.status === 'COMPLETED';
    recordResult(6, 'Workflow Processing Engine (8 Steps)', wfSuccess, `Workflow ID: ${autoApprovedWorkflowId}`);
  } catch (err: any) {
    recordResult(6, 'Workflow Processing Engine (8 Steps)', false, err.message);
  }

  // -------------------------------------------------------------
  // 7. Approval Routing & Manager Decision
  // -------------------------------------------------------------
  let multiDayApprovalId = '';
  try {
    // Submit 5-day leave (requires approval)
    const longLeaveRes = await request(app)
      .post('/api/v1/leaves/apply')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({
        leaveTypeId: 'PAID',
        startDate: '2026-09-10',
        endDate: '2026-09-15',
        days: 5,
        reason: 'Smoke test manager approval request',
      });

    multiDayApprovalId = longLeaveRes.body.data?.approvalId;

    // Manager decides approval
    const decideRes = await request(app)
      .post(`/api/v1/approvals/${multiDayApprovalId}/decide`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        decision: 'APPROVED',
        comments: 'Approved in smoke test',
      });

    const approvalWorks = decideRes.status === 200 && (decideRes.body.data?.status === 'COMPLETED' || decideRes.body.success === true);
    recordResult(7, 'Approval Routing & Decision Processing', approvalWorks, `Approval ID: ${multiDayApprovalId}`);
  } catch (err: any) {
    recordResult(7, 'Approval Routing & Decision Processing', false, err.message);
  }

  // -------------------------------------------------------------
  // 8. Notification Engine (In-App & SSE Dispatch)
  // -------------------------------------------------------------
  try {
    const notificationService = NotificationService.getInstance();
    const notifRes = await notificationService.send({
      recipientId: 'emp_smoke_001',
      type: 'LEAVE_APPROVED',
      title: 'Smoke Test Notification',
      message: 'Your leave has been approved',
      channels: [NotificationChannel.IN_APP, NotificationChannel.SSE_STREAM],
    });

    const notificationsQuery = await request(app)
      .get('/api/v1/notifications')
      .set('Authorization', `Bearer ${employeeToken}`);

    const notifWorks = notifRes.success && notificationsQuery.body.data?.length > 0;
    recordResult(8, 'Notification Delivery & Read Engine', notifWorks, `Delivered to In-App & SSE`);
  } catch (err: any) {
    recordResult(8, 'Notification Delivery & Read Engine', false, err.message);
  }

  // -------------------------------------------------------------
  // 9. Immutable Audit Logging
  // -------------------------------------------------------------
  try {
    const auditService = AuditService.getInstance();
    const auditLog = await auditService.recordAudit({
      userId: 'emp_smoke_001',
      userRole: Role.EMPLOYEE,
      action: 'SMOKE_TEST_AUDIT',
      resourceType: 'platform',
      resourceId: 'res_smoke_001',
      status: 'SUCCESS',
      correlationId: 'trace_smoke_audit_01',
    });

    const auditQuery = await request(app)
      .get(`/api/v1/audit/logs/${auditLog.auditId}`)
      .set('Authorization', `Bearer ${hrToken}`);

    const auditWorks = auditQuery.status === 200 && auditQuery.body.data?.auditId === auditLog.auditId;
    recordResult(9, 'Immutable Audit Trail & Compliance Store', auditWorks, `Audit ID: ${auditLog.auditId}`);
  } catch (err: any) {
    recordResult(9, 'Immutable Audit Trail & Compliance Store', false, err.message);
  }

  // -------------------------------------------------------------
  // 10. Critical Leave Workflow End-to-End Execution
  // -------------------------------------------------------------
  try {
    const reqId = `e2e_${uuidv4().substring(0, 8)}`;
    const e2eRes = await request(app)
      .post('/api/v1/leaves/apply')
      .set('Authorization', `Bearer ${employeeToken}`)
      .set('X-Request-Id', reqId)
      .send({
        leaveTypeId: 'PAID',
        startDate: '2026-10-01',
        endDate: '2026-10-02',
        days: 2,
        reason: 'End-to-End Critical Flow Final Verification',
      });

    const wfId = e2eRes.body.data?.workflowId;

    // Verify workflow state
    const stateRes = await request(app)
      .get(`/api/v1/workflows/${wfId}`)
      .set('Authorization', `Bearer ${employeeToken}`);

    const e2eWorks =
      stateRes.status === 200 &&
      stateRes.body.data?.status === 'COMPLETED' &&
      stateRes.body.data?.stepResults['1_VALIDATION'].status === 'SUCCESS' &&
      stateRes.body.data?.stepResults['5_DETERMINISTIC_ACTION'].status === 'SUCCESS' &&
      stateRes.body.data?.stepResults['8_AUDIT_LOGGING'].status === 'SUCCESS';

    recordResult(10, 'Critical Leave Workflow End-to-End Execution', e2eWorks, `Workflow ${wfId} fully verified`);
  } catch (err: any) {
    recordResult(10, 'Critical Leave Workflow End-to-End Execution', false, err.message);
  }

  console.log('=================================================================');
  console.log(`📊 Smoke Test Summary: ${passedCount}/10 PASSED (${failedCount} Failed)`);
  console.log('=================================================================');

  if (failedCount > 0) {
    process.exit(1);
  }
}

// Execute if run directly
if (require.main === module) {
  runSmokeTests()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Fatal Smoke Test Error:', err);
      process.exit(1);
    });
}
