import { Controller, Get, Post, Body, Param, UseGuards, Request } from '@nestjs/common';
import { WorkflowService } from './workflow.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@Controller('workflow')
@UseGuards(JwtAuthGuard, RolesGuard)
export class WorkflowController {
  constructor(private readonly workflowService: WorkflowService) {}

  @Post('workflows')
  @Roles('admin', 'super_admin')
  createWorkflow(@Body() createWorkflowDto: any) {
    return this.workflowService.createWorkflow(createWorkflowDto);
  }

  @Post('steps')
  @Roles('admin', 'super_admin')
  addStep(@Body() createStepDto: any) {
    return this.workflowService.addStep(createStepDto);
  }

  @Get('approvals')
  getMyApprovals(@Request() req) {
    return this.workflowService.getApprovalsForUser(req.user.id, req.user.role);
  }

  @Post('approvals/:id/process')
  processApproval(
    @Param('id') id: string,
    @Body() body: { action: 'approve' | 'reject' | 'return'; comments?: string },
    @Request() req,
  ) {
    return this.workflowService.processApproval(id, req.user.id, body.action, body.comments);
  }
}
