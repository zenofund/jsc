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
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { StaffService } from './staff.service';
import { AllowancesService } from '@modules/allowances/allowances.service';
import { DeductionsService } from '@modules/deductions/deductions.service';
import { CreateStaffDto, BulkCreateStaffDto } from './dto/create-staff.dto';
import { UpdateStaffDto } from './dto/update-staff.dto';
import { QueryStaffDto } from './dto/query-staff.dto';
import { RolesGuard } from '@common/guards/roles.guard';
import { Roles } from '@common/decorators/roles.decorator';

@ApiTags('Staff')
@ApiBearerAuth()
@Controller('staff')
@UseGuards(RolesGuard)
export class StaffController {
  constructor(
    private readonly staffService: StaffService,
    private readonly allowancesService: AllowancesService,
    private readonly deductionsService: DeductionsService,
  ) {}

  @Post()
  @Roles('admin', 'hr_manager')
  @ApiOperation({ summary: 'Create new staff member' })
  @ApiResponse({ status: 201, description: 'Staff created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  create(@Body() createStaffDto: CreateStaffDto, @Request() req) {
    return this.staffService.create(createStaffDto, req.user.userId);
  }

  @Get()
  @Roles('admin', 'hr_manager', 'payroll_officer', 'payroll_loader')
  @ApiOperation({ summary: 'Get all staff with pagination and filtering' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'status', required: false, type: String })
  @ApiQuery({ name: 'departmentId', required: false, type: String })
  @ApiQuery({ name: 'employmentType', required: false, type: String })
  findAll(@Query() query: QueryStaffDto) {
    return this.staffService.findAll(query);
  }

  @Get('next-staff-number')
  @ApiOperation({ summary: 'Get next available staff number' })
  getNextStaffNumber() {
    return this.staffService.getNextStaffNumber();
  }

  @Get('statistics')
  @ApiOperation({ summary: 'Get staff statistics' })
  getStatistics() {
    return this.staffService.getStatistics();
  }


  @Get('payroll-eligible')
  @Roles('admin', 'payroll_officer', 'hr_manager', 'accountant', 'payroll_loader')
  @ApiOperation({ summary: 'Get staff eligible for payroll processing' })
  getPayrollEligible() {
    return this.staffService.getPayrollEligibleStaff();
  }

  @Get('by-number/:staffNumber')
  @ApiOperation({ summary: 'Get staff by staff number' })
  findByStaffNumber(@Param('staffNumber') staffNumber: string) {
    return this.staffService.findByStaffNumber(staffNumber);
  }

  @Get('allowances')
  @ApiOperation({ summary: 'Get allowances for a specific staff member' })
  @ApiQuery({ name: 'staff_id', required: true, type: String })
  findStaffAllowances(@Query('staff_id') staffId: string) {
    return this.allowancesService.findStaffAllowances(staffId, {});
  }

  @Get('deductions')
  @ApiOperation({ summary: 'Get deductions for a specific staff member' })
  @ApiQuery({ name: 'staff_id', required: true, type: String })
  findStaffDeductions(@Query('staff_id') staffId: string) {
    return this.deductionsService.findStaffDeductions(staffId, {});
  }

  @Get('dashboard-stats/:id')
  @ApiOperation({ summary: 'Get staff dashboard statistics' })
  getDashboardStats(@Param('id') id: string) {
    return this.staffService.getDashboardStats(id);
  }

  @Get('requests/staff/:id')
  @ApiOperation({ summary: 'Get staff requests' })
  getStaffRequests(@Param('id') id: string) {
    return this.staffService.getStaffRequests(id);
  }

  @Post('requests')
  @ApiOperation({ summary: 'Create staff request' })
  createStaffRequest(@Body() body: any, @Request() req) {
    return this.staffService.createStaffRequest(body, req.user.userId);
  }

  @Get('requests')
  @Roles('admin', 'hr_manager')
  @ApiOperation({ summary: 'List staff requests with filters' })
  @ApiQuery({ name: 'status', required: false, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  findAllRequests(@Query('status') status?: string, @Query('page') page?: number, @Query('limit') limit?: number) {
    return this.staffService.findAllStaffRequests({ status, page, limit });
  }

  @Post('requests/:id/approve')
  @Roles('admin', 'hr_manager')
  @ApiOperation({ summary: 'Approve staff request' })
  approveRequest(@Param('id') id: string, @Body() body: { notes?: string }, @Request() req) {
    return this.staffService.processStaffRequest(id, 'approved', body?.notes, req.user.userId);
  }

  @Post('requests/:id/reject')
  @Roles('admin', 'hr_manager')
  @ApiOperation({ summary: 'Reject staff request' })
  rejectRequest(@Param('id') id: string, @Body() body: { notes?: string }, @Request() req) {
    return this.staffService.processStaffRequest(id, 'rejected', body?.notes, req.user.userId);
  }

  @Get('documents/:id')
  @ApiOperation({ summary: 'Get staff documents' })
  getStaffDocuments(@Param('id') id: string) {
    return this.staffService.getStaffDocuments(id);
  }

  @Post('documents')
  @ApiOperation({ summary: 'Upload staff document' })
  createStaffDocument(@Body() body: any, @Request() req) {
    return this.staffService.createStaffDocument(body, req.user.userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get staff by ID' })
  @ApiResponse({ status: 200, description: 'Staff found' })
  @ApiResponse({ status: 404, description: 'Staff not found' })
  findOne(@Param('id') id: string) {
    return this.staffService.findOne(id);
  }

  @Patch(':id')
  @Roles('admin', 'hr_manager')
  @ApiOperation({ summary: 'Update staff information' })
  @ApiResponse({ status: 200, description: 'Staff updated successfully' })
  update(@Param('id') id: string, @Body() updateStaffDto: UpdateStaffDto, @Request() req) {
    return this.staffService.update(id, updateStaffDto, req.user.userId);
  }

  @Delete(':id')
  @Roles('admin')
  @ApiOperation({ summary: 'Delete staff (soft delete)' })
  @ApiResponse({ status: 200, description: 'Staff deleted successfully' })
  remove(@Param('id') id: string, @Request() req) {
    return this.staffService.remove(id, req.user.userId);
  }

  @Post('bulk-import')
  @Roles('admin', 'hr_manager')
  @ApiOperation({ summary: 'Bulk import staff records' })
  bulkImport(@Body() staffRecords: BulkCreateStaffDto[], @Request() req) {
    return this.staffService.bulkImport(staffRecords, req.user.userId);
  }

  @Post('sync-users')
  @Roles('admin')
  @ApiOperation({ summary: 'Sync legacy staff members who do not have user accounts' })
  syncLegacyStaffUsers(@Request() req) {
    return this.staffService.syncLegacyStaffUsers(req.user.userId);
  }

  @Post(':id/create-user')
  @Roles('admin')
  @ApiOperation({ summary: 'Create user account for staff member and send welcome email' })
  @ApiResponse({ status: 201, description: 'User account created and welcome email sent' })
  createUserAccount(
    @Param('id') id: string,
    @Body() body: { role: string },
    @Request() req,
  ) {
    return this.staffService.createUserAccount(id, body.role, req.user.userId);
  }
}
