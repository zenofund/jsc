import { Controller, Get, Post, Put, Patch, Body, Param, Query, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { LeaveService } from './leave.service';
import { RolesGuard } from '@common/guards/roles.guard';
import { Roles } from '@common/decorators/roles.decorator';
import { CreateLeaveTypeDto, CreateLeaveRequestDto, ApproveLeaveDto, LeaveStatus } from './dto/leave.dto';

@ApiTags('Leave Management')
@ApiBearerAuth()
@Controller('leave')
@UseGuards(RolesGuard)
export class LeaveController {
  constructor(private readonly leaveService: LeaveService) {}

  // ==================== LEAVE TYPES ====================

  @Post('types')
  @ApiOperation({ summary: 'Create leave type' })
  createLeaveType(@Body() dto: CreateLeaveTypeDto, @Request() req) {
    return this.leaveService.createLeaveType(dto, req.user.userId);
  }

  @Get('types')
  @ApiOperation({ summary: 'Get all leave types' })
  findAllLeaveTypes(@Query('status') status?: string) {
    return this.leaveService.findAllLeaveTypes(status);
  }

  @Get('types/:id')
  @ApiOperation({ summary: 'Get leave type by ID' })
  findOneLeaveType(@Param('id') id: string) {
    return this.leaveService.findOneLeaveType(id);
  }

  // ==================== LEAVE BALANCES ====================

  @Post('balances/initialize')
  @ApiOperation({ summary: 'Initialize leave balances for all staff for a year' })
  initializeLeaveBalances(@Body('year') year: number, @Request() req) {
    return this.leaveService.initializeLeaveBalances(year, req.user.userId);
  }

  @Get('balances/staff/:staffId')
  @ApiOperation({ summary: 'Get staff leave balances' })
  getStaffLeaveBalances(@Param('staffId') staffId: string, @Query('year') year?: number) {
    return this.leaveService.getStaffLeaveBalances(staffId, year ? parseInt(String(year)) : undefined);
  }

  // ==================== LEAVE REQUESTS ====================

  @Post('requests')
  @ApiOperation({ summary: 'Create leave request' })
  createLeaveRequest(@Body() dto: CreateLeaveRequestDto, @Request() req) {
    return this.leaveService.createLeaveRequest(dto, req.user.userId);
  }

  @Get('requests')
  @ApiOperation({ summary: 'Get all leave requests' })
  findAllLeaveRequests(
    @Query('staffId') staffId?: string,
    @Query('leaveTypeId') leaveTypeId?: string,
    @Query('status') status?: LeaveStatus,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.leaveService.findAllLeaveRequests({
      staffId,
      leaveTypeId,
      status,
      page: page ? parseInt(String(page)) : 1,
      limit: limit ? parseInt(String(limit)) : 20,
    });
  }

  @Get('requests/staff/:staffId')
  @ApiOperation({ summary: 'Get all leave requests for a staff member' })
  findStaffLeaveRequests(
    @Param('staffId') staffId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.leaveService.findAllLeaveRequests({
      staffId,
      page: page ? parseInt(String(page)) : 1,
      limit: limit ? parseInt(String(limit)) : 20,
    });
  }

  @Get('requests/:id')
  @ApiOperation({ summary: 'Get leave request by ID' })
  findOneLeaveRequest(@Param('id') id: string) {
    return this.leaveService.findOneLeaveRequest(id);
  }

  @Patch('requests/:id/approve')
  @Roles('hr_manager')
  @ApiOperation({ summary: 'Approve leave request' })
  approveLeaveRequest(
    @Param('id') id: string,
    @Body() dto: ApproveLeaveDto,
    @Request() req,
  ) {
    return this.leaveService.approveLeaveRequest(id, dto, req.user.userId);
  }

  @Patch('requests/:id/reject')
  @Roles('hr_manager')
  @ApiOperation({ summary: 'Reject leave request' })
  rejectLeaveRequest(
    @Param('id') id: string,
    @Body('remarks') remarks: string,
    @Request() req,
  ) {
    return this.leaveService.rejectLeaveRequest(id, remarks, req.user.userId);
  }

  @Patch('requests/:id/cancel')
  @ApiOperation({ summary: 'Cancel leave request' })
  cancelLeaveRequest(@Param('id') id: string, @Request() req) {
    return this.leaveService.cancelLeaveRequest(id, req.user.userId);
  }
}
