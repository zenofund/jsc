import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { DatabaseService } from '../../common/database/database.service';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/dto/audit.dto';
import { NotificationsService } from '@modules/notifications/notifications.service';
import { NotificationType, NotificationCategory, NotificationPriority } from '@modules/notifications/dto/notification.dto';

@Injectable()
export class WorkflowService {
  private readonly logger = new Logger(WorkflowService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async createWorkflow(data: any) {
    return this.db.queryOne(
      `INSERT INTO approval_workflows (name, description, entity_type) 
       VALUES ($1, $2, $3) RETURNING *`,
      [data.name, data.description, data.entity_type]
    );
  }

  async addStep(data: any) {
    return this.db.queryOne(
      `INSERT INTO approval_steps (workflow_id, step_order, role_required, specific_user_id, is_final, label)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [data.workflow_id, data.step_order, data.role_required, data.specific_user_id, data.is_final, data.label]
    );
  }

  async getApprovalsForUser(userId: string, userRole: string) {
    const normalizeRole = (role: any) => {
      const r = String(role || '').trim().toLowerCase();
      if (r === 'reviewer') return 'checking';
      if (r === 'approver') return 'cpo';
      return r;
    };
    const roleAliases = (role: any) => {
      const normalized = normalizeRole(role);
      if (normalized === 'checking') return ['checking', 'reviewer'];
      if (normalized === 'cpo') return ['cpo', 'approver'];
      return [normalized];
    };
    // Find requests where the user is an approver based on role or specific ID
    const sql = `
      SELECT r.*, w.name as workflow_name, s.label as step_label,
             u.full_name as requester_name, u.email as requester_email
      FROM approval_requests r
      JOIN approval_workflows w ON r.workflow_id = w.id
      JOIN approval_steps s ON r.workflow_id = s.workflow_id AND r.current_step = s.step_order
      LEFT JOIN users u ON r.requester_id = u.id
      WHERE r.status = 'pending'
      AND (
        s.specific_user_id = $1
        OR LOWER(s.role_required) = ANY($2)
      )
      ORDER BY r.created_at DESC
    `;
    
    return this.db.query(sql, [userId, roleAliases(userRole)]);
  }

  async processApproval(requestId: string, approverId: string, action: 'approve' | 'reject' | 'return', comments?: string) {
    // 1. Get request and current step
    const request = await this.db.queryOne(
      `SELECT r.*, s.is_final, s.step_order, s.role_required, s.specific_user_id
       FROM approval_requests r
       JOIN approval_steps s ON r.workflow_id = s.workflow_id AND r.current_step = s.step_order
       WHERE r.id = $1`,
      [requestId]
    );

    if (!request) throw new NotFoundException('Request not found');

    // 2. Validate permission
    const approver = await this.db.queryOne('SELECT role FROM users WHERE id = $1', [approverId]);
    const normalizeRole = (role: any) => {
      const r = String(role || '').trim().toLowerCase();
      if (r === 'reviewer') return 'checking';
      if (r === 'approver') return 'cpo';
      return r;
    };
    
    // Check if user is authorized to approve
    const isSpecificUser = request.specific_user_id === approverId;
    const hasRole = normalizeRole(request.role_required) === normalizeRole(approver.role);
    const isAdmin = normalizeRole(approver.role) === 'admin' || normalizeRole(approver.role) === 'super_admin';

    if (!isSpecificUser && !hasRole && !isAdmin) {
         // Allow admin override for now
         throw new BadRequestException('Not authorized to approve this request');
    }

    if (action === 'approve') {
        if (request.is_final) {
            await this.db.query(`UPDATE approval_requests SET status = 'approved', updated_at = NOW() WHERE id = $1`, [requestId]);
            await this.notifyRequester(requestId, 'approved');
        } else {
            // Check if there is a next step
            const nextStep = await this.db.queryOne(
                'SELECT step_order FROM approval_steps WHERE workflow_id = $1 AND step_order > $2 ORDER BY step_order ASC LIMIT 1',
                [request.workflow_id, request.step_order]
            );
            
            if (nextStep) {
                await this.db.query(`UPDATE approval_requests SET current_step = $1, updated_at = NOW() WHERE id = $2`, [nextStep.step_order, requestId]);
                await this.notifyApprovers(request.workflow_id, nextStep.step_order, requestId);
            } else {
                // No next step, mark approved
                await this.db.query(`UPDATE approval_requests SET status = 'approved', updated_at = NOW() WHERE id = $1`, [requestId]);
                await this.notifyRequester(requestId, 'approved');
            }
        }
    } else if (action === 'reject') {
        await this.db.query(`UPDATE approval_requests SET status = 'rejected', updated_at = NOW() WHERE id = $1`, [requestId]);
        await this.notifyRequester(requestId, 'rejected');
    } else if (action === 'return') {
         await this.db.query(`UPDATE approval_requests SET status = 'returned', current_step = 1, updated_at = NOW() WHERE id = $1`, [requestId]);
         await this.notifyRequester(requestId, 'returned');
    }

    // Log action
    await this.db.query(
        `INSERT INTO approval_actions (request_id, approver_id, action, comments, step_number)
         VALUES ($1, $2, $3, $4, $5)`,
        [requestId, approverId, action, comments, request.step_order]
    );

    // Log to Audit Trail
    await this.auditService.log({
      userId: approverId,
      action: action === 'approve' ? AuditAction.APPROVE : (action === 'reject' ? AuditAction.REJECT : AuditAction.UPDATE),
      entity: 'approval_request',
      entityId: requestId,
      description: `Workflow action: ${action} on request ${requestId}`,
      oldValues: { status: request.status, step: request.current_step },
      newValues: { action, comments }
    });

    return { success: true };
  }

  // Helper to start a workflow
  async startWorkflow(workflowName: string, entityId: string | null, requesterId: string, data?: any) {
      const workflow = await this.db.queryOne('SELECT id FROM approval_workflows WHERE name = $1', [workflowName]);
      if (!workflow) throw new NotFoundException(`Workflow ${workflowName} not found`);

      // Get first step
      const firstStep = await this.db.queryOne(
          'SELECT step_order FROM approval_steps WHERE workflow_id = $1 ORDER BY step_order ASC LIMIT 1',
          [workflow.id]
      );
      
      if (!firstStep) throw new BadRequestException('Workflow has no steps');

      const request = await this.db.queryOne(
          `INSERT INTO approval_requests (workflow_id, request_type, request_entity_id, requester_id, current_step, status, data)
           VALUES ($1, $2, $3, $4, $5, 'pending', $6) RETURNING *`,
          [workflow.id, 'general', entityId, requesterId, firstStep.step_order, data]
      );

      await this.notifyApprovers(workflow.id, firstStep.step_order, request.id);

      return request;
  }

  async createRequest(workflowName: string, entityType: string, entityId: string, requesterId: string) {
    return this.startWorkflow(workflowName, entityId, requesterId);
  }

  private async notifyApprovers(workflowId: string, stepOrder: number, requestId: string) {
    try {
      const step = await this.db.queryOne(
        'SELECT * FROM approval_steps WHERE workflow_id = $1 AND step_order = $2',
        [workflowId, stepOrder],
      );

      if (!step) return;

      let recipientIds: string[] = [];

      if (step.specific_user_id) {
        recipientIds.push(step.specific_user_id);
      } else if (step.role_required) {
        const users = await this.db.query('SELECT id FROM users WHERE role = $1', [step.role_required]);
        recipientIds = users.map((u) => u.id);
      }

      for (const id of recipientIds) {
        await this.notificationsService.create({
          recipient_id: id,
          type: NotificationType.APPROVAL,
          category: NotificationCategory.ACTION_REQUIRED,
          title: 'Approval Required',
          message: `A request requires your approval (Step ${step.label || stepOrder}).`,
          entity_type: 'approval_request',
          entity_id: requestId,
          priority: NotificationPriority.HIGH,
        });
      }
    } catch (error) {
      this.logger.error(`Failed to notify approvers: ${error.message}`);
    }
  }

  private async notifyRequester(requestId: string, status: string) {
    try {
      const request = await this.db.queryOne('SELECT requester_id FROM approval_requests WHERE id = $1', [requestId]);
      if (!request) return;

      let title = 'Request Update';
      let message = `Your request status has been updated to ${status}.`;

      if (status === 'approved') {
        title = 'Request Approved';
        message = 'Your request has been approved.';
      } else if (status === 'rejected') {
        title = 'Request Rejected';
        message = 'Your request has been rejected.';
      } else if (status === 'returned') {
        title = 'Request Returned';
        message = 'Your request has been returned for corrections.';
      }

      await this.notificationsService.create({
        recipient_id: request.requester_id,
        type: NotificationType.APPROVAL,
        category: NotificationCategory.INFO,
        title: title,
        message: message,
        entity_type: 'approval_request',
        entity_id: requestId,
        priority: NotificationPriority.HIGH,
      });
    } catch (error) {
      this.logger.error(`Failed to notify requester: ${error.message}`);
    }
  }
}
