import { Controller, Get, Post, Body, Param, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { PromotionsService } from './promotions.service';
import { RolesGuard } from '@common/guards/roles.guard';
import { Roles } from '@common/decorators/roles.decorator';

@ApiTags('Promotions')
@ApiBearerAuth()
@Controller('promotions')
@UseGuards(RolesGuard)
export class PromotionsController {
  constructor(private readonly promotionsService: PromotionsService) {}

  @Get('staff/:staffId')
  @ApiOperation({ summary: 'Get staff promotion history' })
  getStaffPromotions(@Param('staffId') staffId: string) {
    return this.promotionsService.getStaffPromotions(staffId);
  }

  @Post('preview-arrears')
  @Roles('admin', 'payroll_officer', 'hr_manager')
  @ApiOperation({ summary: 'Preview arrears for a promotion' })
  previewArrears(@Body() body: any) {
    return this.promotionsService.calculateArrearsPreview(
      body.staffId,
      body.newGradeLevel,
      body.newStep,
      body.effectiveDate
    );
  }

  @Post('create')
  @Roles('admin', 'payroll_officer', 'hr_manager')
  @ApiOperation({ summary: 'Promote a staff member' })
  promoteStaff(@Body() promoteStaffDto: any, @Request() req) {
    return this.promotionsService.createPromotion(promoteStaffDto, req.user.userId);
  }

  @Post(':id/approve')
  @Roles('admin', 'hr_manager')
  @ApiOperation({ summary: 'Approve promotion' })
  approvePromotion(@Param('id') id: string, @Request() req) {
    return this.promotionsService.approvePromotion(id, req.user.userId);
  }

  @Post(':id/reject')
  @Roles('admin', 'hr_manager')
  @ApiOperation({ summary: 'Reject promotion' })
  rejectPromotion(@Param('id') id: string, @Body() body: any, @Request() req) {
    return this.promotionsService.rejectPromotion(id, req.user.userId, body.reason);
  }

  @Get('eligible')
  @Roles('admin', 'payroll_officer', 'hr_manager')
  @ApiOperation({ summary: 'Get staff eligible for promotion' })
  getEligiblePromotions() {
    return this.promotionsService.getEligiblePromotions();
  }

  @Get()
  @ApiOperation({ summary: 'Get all promotions' })
  getAll() {
    return this.promotionsService.getAll();
  }
}
