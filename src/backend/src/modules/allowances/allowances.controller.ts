import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  Request,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AllowancesService } from './allowances.service';
import { RolesGuard } from '@common/guards/roles.guard';
import { Permissions } from '@common/decorators/permissions.decorator';

@ApiTags('Allowances')
@ApiBearerAuth()
@Controller('allowances')
@UseGuards(RolesGuard)
export class AllowancesController {
  constructor(private readonly allowancesService: AllowancesService) {}

  // ==================== GLOBAL ALLOWANCES ====================

  @Post('global')
  @Permissions('staff.allowance.catalog.create')
  @ApiOperation({ summary: 'Create global allowance' })
  createGlobalAllowance(@Body() dto: any, @Request() req) {
    return this.allowancesService.createGlobalAllowance(dto, req.user.userId);
  }

  @Get('global')
  @Permissions('staff.allowance.catalog.read')
  @ApiOperation({ summary: 'Get all global allowances' })
  findAllGlobalAllowances(@Query() query: any) {
    return this.allowancesService.findAllGlobalAllowances(query);
  }

  @Patch('global/:id')
  @Permissions('staff.allowance.catalog.update')
  @ApiOperation({ summary: 'Update global allowance' })
  updateGlobalAllowance(@Param('id') id: string, @Body() dto: any, @Request() req) {
    return this.allowancesService.updateGlobalAllowance(id, dto, req.user.userId);
  }

  @Delete('global/:id')
  @Permissions('staff.allowance.catalog.delete')
  @ApiOperation({ summary: 'Delete global allowance' })
  removeGlobalAllowance(@Param('id') id: string, @Request() req) {
    return this.allowancesService.removeGlobalAllowance(id, req.user.userId);
  }

  // ==================== STAFF-SPECIFIC ALLOWANCES ====================

  @Post('staff')
  @Permissions('staff.allowance.create')
  @ApiOperation({ summary: 'Create staff-specific allowance' })
  createStaffAllowance(@Body() dto: any, @Request() req) {
    return this.allowancesService.createStaffAllowance(dto, req.user.userId, req.user.role);
  }

  @Get('staff/all')
  @Permissions('staff.allowance.read')
  @ApiOperation({ summary: 'Get all staff allowances with pagination' })
  findAllStaffAllowances(@Query() query: any) {
    return this.allowancesService.findAllStaffAllowances(query);
  }

  @Get('staff/:staffId')
  @Permissions('staff.allowance.read')
  @ApiOperation({ summary: 'Get allowances for a specific staff member' })
  findStaffAllowances(@Param('staffId') staffId: string, @Query() query: any) {
    return this.allowancesService.findStaffAllowances(staffId, query);
  }

  @Patch('staff/bulk-status')
  @Permissions('staff.allowance.status.update')
  @ApiOperation({ summary: 'Bulk update status of staff allowances' })
  bulkUpdateStaffAllowanceStatus(@Body() body: { ids: string[], status: string }, @Request() req) {
    return this.allowancesService.bulkUpdateStaffAllowanceStatus(body.ids, body.status, req.user.userId);
  }

  @Patch('staff/:id')
  @Permissions('staff.allowance.update')
  @ApiOperation({ summary: 'Update staff-specific allowance' })
  updateStaffAllowance(@Param('id') id: string, @Body() dto: any, @Request() req) {
    if (
      dto && Object.prototype.hasOwnProperty.call(dto, 'status') &&
      !req.user.permissions?.includes('staff.allowance.status.update')
    ) {
      throw new ForbiddenException('You do not have permission to change allowance status');
    }
    return this.allowancesService.updateStaffAllowance(id, dto, req.user.userId);
  }

  @Delete('staff/:id')
  @Permissions('staff.allowance.delete')
  @ApiOperation({ summary: 'Delete staff-specific allowance' })
  removeStaffAllowance(@Param('id') id: string, @Request() req) {
    return this.allowancesService.removeStaffAllowance(id, req.user.userId);
  }
}
