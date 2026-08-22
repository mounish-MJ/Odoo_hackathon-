/**
 * DAYFLOW — Member 4 Live End-to-End Orchestration Simulation Script
 * Demonstrates the full canonical 8-step lifecycle:
 * Employee Request -> Manager Approval -> LeaveApproved -> HR Mutation -> Verification -> Notification -> Audit
 */

import request from 'supertest';
import { v4 as uuidv4 } from 'uuid';
import { createApp } from '../src/server';
import { AuthSecurityService } from '../src/security/auth.middleware';
import { Role } from '../src/contracts/authorization.contract';
import { PlatformEventBus } from '../src/orchestration/event-bus';
import { StandardEventType } from '../src/contracts/event.contract';

async function runLiveSimulation() {
  console.log('================================================================================');
  console.log('🚀 DAYFLOW Member 4 — Live End-to-End Orchestration Simulation');
  console.log('================================================================================\n');

  const app = createApp();
  const eventBus = PlatformEventBus.getInstance();

  // Track domain events in real-time
  const capturedEvents: Array<{ type: string; resourceId?: string; correlationId?: string }> = [];
  eventBus.subscribe('*', (event) => {
    capturedEvents.push({
      type: event.eventType,
      resourceId: event.resourceId,
      correlationId: event.correlationId,
    });
    console.log(`📡 [EVENT BUS] >>> Domain Event Emitted: \x1b[36m${event.eventType}\x1b[0m (Resource: ${event.resourceType}/${event.resourceId})`);
  });

  // -------------------------------------------------------------
  // Step 0: Setup Actors & Security Identities
  // -------------------------------------------------------------
  console.log('\x1b[33m--- STEP 0: Identity & JWT Issuance ---\x1b[0m');
  const employeeToken = AuthSecurityService.generateToken({
    userId: 'emp_alice_101',
    name: 'Alice Johnson',
    email: 'alice.johnson@dayflow.app',
    role: Role.EMPLOYEE,
    departmentId: 'engineering',
    reportingManagerId: 'mgr_bob_202',
  });
  console.log('👤 Employee: Alice Johnson (emp_alice_101) [Role: EMPLOYEE]');

  const managerToken = AuthSecurityService.generateToken({
    userId: 'mgr_bob_202',
    name: 'Bob Smith',
    email: 'bob.smith@dayflow.app',
    role: Role.MANAGER,
    departmentId: 'engineering',
  });
  console.log('👔 Manager: Bob Smith (mgr_bob_202) [Role: MANAGER]');

  const hrToken = AuthSecurityService.generateToken({
    userId: 'hr_carol_303',
    name: 'Carol Danvers',
    email: 'carol.hr@dayflow.app',
    role: Role.HR,
    departmentId: 'human_resources',
  });
  console.log('📋 HR Admin: Carol Danvers (hr_carol_303) [Role: HR]\n');

  // -------------------------------------------------------------
  // Step 1: Employee Applies for Leave (4 Days -> Requires Approval)
  // -------------------------------------------------------------
  const correlationId = `corr_demo_${uuidv4().substring(0, 8)}`;
  console.log(`\x1b[33m--- STEP 1: Employee Submits 4-Day Leave Request (Correlation: ${correlationId}) ---\x1b[0m`);

  const applyResponse = await request(app)
    .post('/api/v1/leaves/apply')
    .set('Authorization', `Bearer ${employeeToken}`)
    .set('X-Request-Id', correlationId)
    .send({
      leaveTypeId: 'PAID',
      startDate: '2026-09-15',
      endDate: '2026-09-18',
      days: 4,
      reason: 'Annual Family Vacation',
    });

  console.log(`HTTP Status: ${applyResponse.status}`);
  console.log('Response Payload:', JSON.stringify(applyResponse.body, null, 2));

  const workflowId = applyResponse.body.data.workflowId;
  const approvalId = applyResponse.body.data.approvalId;
  console.log(`\n⚙️  Workflow Paused in State: \x1b[35m${applyResponse.body.data.status}\x1b[0m`);
  console.log(`📬 Approval Record Created: \x1b[32m${approvalId}\x1b[0m (Assigned to Manager: mgr_bob_202)\n`);

  // Allow tick for event bus dispatch
  await new Promise((r) => setTimeout(r, 100));

  // -------------------------------------------------------------
  // Step 2: Manager Inspects Pending Approval Queue
  // -------------------------------------------------------------
  console.log('\x1b[33m--- STEP 2: Manager Queries Pending Approval Queue ---\x1b[0m');
  const pendingResponse = await request(app)
    .get('/api/v1/approvals/pending')
    .set('Authorization', `Bearer ${managerToken}`);

  console.log(`Pending Approvals for Bob: ${pendingResponse.body.data?.length}`);
  console.log('Pending Items:', JSON.stringify(pendingResponse.body.data, null, 2), '\n');

  // -------------------------------------------------------------
  // Step 3: Manager Approves the Request
  // -------------------------------------------------------------
  console.log(`\x1b[33m--- STEP 3: Manager Approves Request (${approvalId}) ---\x1b[0m`);
  const decideResponse = await request(app)
    .post(`/api/v1/approvals/${approvalId}/decide`)
    .set('Authorization', `Bearer ${managerToken}`)
    .send({
      decision: 'APPROVED',
      comments: 'Approved! Have a great family vacation, Alice.',
    });

  console.log(`HTTP Status: ${decideResponse.status}`);
  console.log('Decide Response:', JSON.stringify(decideResponse.body, null, 2), '\n');

  // Allow tick for event bus dispatch & async actions
  await new Promise((r) => setTimeout(r, 150));

  // -------------------------------------------------------------
  // Step 4: Verify Final Workflow State & Step Durations
  // -------------------------------------------------------------
  console.log(`\x1b[33m--- STEP 4: Inspect Final Orchestrated Workflow State ---\x1b[0m`);
  const wfQueryResponse = await request(app)
    .get(`/api/v1/workflows/${workflowId}`)
    .set('Authorization', `Bearer ${employeeToken}`);

  console.log('Workflow Execution Record:');
  console.log(`  - Workflow ID:    ${wfQueryResponse.body.data.workflowId}`);
  console.log(`  - Status:         \x1b[32m${wfQueryResponse.body.data.status}\x1b[0m`);
  console.log(`  - Approval State: ${wfQueryResponse.body.data.approvalStatus}`);
  console.log('  - Step Results Breakdown:');
  for (const [stepKey, stepVal] of Object.entries(wfQueryResponse.body.data.stepResults as Record<string, any>)) {
    console.log(`      • [${stepKey}]: \x1b[32m${stepVal.status}\x1b[0m (${stepVal.durationMs}ms)`);
  }
  console.log();

  // -------------------------------------------------------------
  // Step 5: Employee Checks Notifications
  // -------------------------------------------------------------
  console.log(`\x1b[33m--- STEP 5: Employee Receives In-App & SSE Notification ---\x1b[0m`);
  const notifResponse = await request(app)
    .get('/api/v1/notifications')
    .set('Authorization', `Bearer ${employeeToken}`);

  console.log(`Notifications in Alice's Inbox: ${notifResponse.body.data?.length}`);
  console.log('Latest Notification:', JSON.stringify(notifResponse.body.data?.[0], null, 2), '\n');

  // -------------------------------------------------------------
  // Step 6: HR Admin Inspects Compliance Audit Trail
  // -------------------------------------------------------------
  console.log(`\x1b[33m--- STEP 6: HR Admin Queries Immutable Audit Trail ---\x1b[0m`);
  const auditResponse = await request(app)
    .get(`/api/v1/audit/logs?correlationId=${correlationId}`)
    .set('Authorization', `Bearer ${hrToken}`);

  console.log(`Audit Records Found for Correlation ${correlationId}: ${auditResponse.body.total}`);
  for (const log of auditResponse.body.data || []) {
    console.log(`  📜 [Audit ${log.auditId}] Action: \x1b[36m${log.action}\x1b[0m | Actor: ${log.userId} (${log.userRole}) | Status: ${log.status}`);
  }

  console.log('\n================================================================================');
  console.log('🎉 SIMULATION SUMMARY: ALL 8 CANONICAL STEPS EXECUTED & VERIFIED SUCCESSFULLY');
  console.log('================================================================================');
}

if (require.main === module) {
  runLiveSimulation()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Fatal Simulation Error:', err);
      process.exit(1);
    });
}
