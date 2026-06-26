import { Controller, Get, Post, Put, Delete, Body, Param, Query, Request, UseGuards, Res, StreamableFile, BadRequestException, NotFoundException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import { RolesGuard } from '@common/guards/roles.guard';
import { Roles } from '@common/decorators/roles.decorator';
import { createReadStream, existsSync } from 'fs';
import { Response } from 'express';
import { Readable } from 'stream';
import {
  CreateReportTemplateDto,
  UpdateReportTemplateDto,
  ExecuteReportDto,
  PreviewReportDto,
  ScheduleReportDto,
  ShareReportDto,
} from './dto/report.dto';

@ApiTags('Custom Reports')
@ApiBearerAuth()
@Controller('reports')
@UseGuards(RolesGuard)
@Roles('admin', 'payroll_officer', 'hr_manager')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  // ==================== STANDARD REPORTS ====================

  @Get('staff')
  @Roles('admin', 'hr_manager', 'payroll_officer')
  @ApiOperation({ summary: 'Get staff report' })
  getStaffReport(
    @Query('department') department?: string,
    @Query('status') status?: string,
  ) {
    return this.reportsService.getStaffReport({ department, status });
  }

  @Get('payroll/:month')
  @Roles('admin', 'payroll_officer')
  @ApiOperation({ summary: 'Get payroll report' })
  getPayrollReport(@Param('month') month: string) {
    return this.reportsService.getPayrollReport(month);
  }

  @Get('payroll/:month/bank-schedule')
  @Roles('admin', 'payroll_officer')
  @ApiOperation({ summary: 'Get payroll bank payment schedule grouped by bank' })
  getPayrollBankSchedule(@Param('month') month: string) {
    return this.reportsService.getPayrollBankSchedule(month);
  }

  @Get('variance')
  @ApiOperation({ summary: 'Get variance report' })
  getVarianceReport(
    @Query('month1') month1: string,
    @Query('month2') month2: string,
  ) {
    return this.reportsService.getVarianceReport(month1, month2);
  }

  @Get('remittance/:month')
  @ApiOperation({ summary: 'Get remittance report' })
  getRemittanceReport(
    @Param('month') month: string,
    @Query('type') type: string,
  ) {
    return this.reportsService.getRemittanceReport(month, type);
  }

  @Get('remittance/:month/paye-schedule')
  @ApiOperation({ summary: 'Get PAYE schedule (CSV or JSON)' })
  async getPayeSchedule(
    @Param('month') month: string,
    @Query('state') state: string,
    @Query('format') format: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const fmt = String(format || 'csv').toLowerCase();
    if (fmt === 'json') {
      const data = await this.reportsService.getPayeSchedule(month, state);
      if (!data) {
        throw new NotFoundException('No payroll batch found for the selected month');
      }
      return data;
    }

    if (fmt !== 'csv') {
      throw new BadRequestException('Unsupported format. Use format=csv or format=json');
    }

    const csv = await this.reportsService.getPayeScheduleCsv(month, state);
    if (!csv) {
      throw new NotFoundException('No payroll batch found for the selected month');
    }

    const safeState = String(state || 'ALL').trim() || 'ALL';
    const safeMonth = String(month || '').trim() || 'month';
    const fileName = `paye_schedule_${safeState}_${safeMonth}.csv`.replace(/[^\w.-]/g, '_');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    return new StreamableFile(Readable.from([csv]));
  }

  // ==================== DATA SOURCES ====================

  @Get('data-sources')
  @ApiOperation({ summary: 'Get available data sources for report building' })
  getDataSources() {
    return this.reportsService.getDataSources();
  }

  // ==================== REPORT TEMPLATES ====================

  @Post('templates')
  @ApiOperation({ summary: 'Create a new report template' })
  createTemplate(@Body() dto: CreateReportTemplateDto, @Request() req) {
    return this.reportsService.createTemplate(dto, req.user.userId);
  }

  @Get('templates')
  @ApiOperation({ summary: 'Get all report templates (owned, public, shared)' })
  findAllTemplates(
    @Request() req,
    @Query('category') category?: string,
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
  ) {
    return this.reportsService.findAllTemplates(
      req.user.userId,
      category,
      page ? parseInt(String(page), 10) : 1,
      pageSize ? parseInt(String(pageSize), 10) : undefined,
    );
  }

  @Get('templates/:id')
  @ApiOperation({ summary: 'Get report template by ID' })
  findOneTemplate(@Param('id') id: string, @Request() req) {
    return this.reportsService.findOneTemplate(id, req.user.userId);
  }

  @Put('templates/:id')
  @ApiOperation({ summary: 'Update report template' })
  updateTemplate(
    @Param('id') id: string,
    @Body() dto: UpdateReportTemplateDto,
    @Request() req,
  ) {
    return this.reportsService.updateTemplate(id, dto, req.user.userId);
  }

  @Delete('templates/:id')
  @ApiOperation({ summary: 'Delete report template' })
  deleteTemplate(@Param('id') id: string, @Request() req) {
    return this.reportsService.deleteTemplate(id, req.user.userId);
  }

  // ==================== REPORT EXECUTION ====================

  @Post('execute')
  @ApiOperation({ summary: 'Execute a report and get live data' })
  executeReport(@Body() dto: ExecuteReportDto, @Request() req) {
    return this.reportsService.executeReport(dto, req.user.userId);
  }

  @Post('preview')
  @ApiOperation({ summary: 'Preview report data without saving a template' })
  previewReport(@Body() dto: PreviewReportDto, @Request() req) {
    return this.reportsService.previewReport(dto, req.user.userId);
  }

  @Get('executions/:templateId')
  @ApiOperation({ summary: 'Get execution history for a report' })
  getExecutionHistory(
    @Param('templateId') templateId: string,
    @Request() req,
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
  ) {
    return this.reportsService.getExecutionHistory(
      templateId,
      req.user.userId,
      page ? parseInt(String(page), 10) : 1,
      pageSize ? parseInt(String(pageSize), 10) : undefined,
    );
  }

  @Get('execution/:executionId')
  @ApiOperation({ summary: 'Get execution status by ID' })
  getExecutionById(@Param('executionId') executionId: string, @Request() req) {
    return this.reportsService.getExecutionById(executionId, req.user.userId);
  }

  @Get('execution/:executionId/download')
  @ApiOperation({ summary: 'Download generated export file for an execution' })
  async downloadExecutionFile(@Param('executionId') executionId: string, @Request() req, @Res({ passthrough: true }) res: Response) {
    const execution = await this.reportsService.getExecutionById(executionId, req.user.userId);
    if (!execution.file_path) {
      throw new BadRequestException('No export file is available for this execution');
    }
    if (!existsSync(execution.file_path)) {
      throw new NotFoundException('The generated export file could not be found');
    }
    const fileName = execution.file_path.split(/[\\/]/).pop() || `report-${executionId}`;
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    return new StreamableFile(createReadStream(execution.file_path));
  }

  // ==================== REPORT SCHEDULES ====================

  @Post('schedules')
  @ApiOperation({ summary: 'Schedule a report for automatic execution' })
  scheduleReport(@Body() dto: ScheduleReportDto, @Request() req) {
    return this.reportsService.scheduleReport(dto, req.user.userId);
  }

  @Get('schedules/:templateId')
  @ApiOperation({ summary: 'Get all schedules for a report' })
  getReportSchedules(@Param('templateId') templateId: string, @Request() req) {
    return this.reportsService.getReportSchedules(templateId, req.user.userId);
  }

  // ==================== REPORT SHARING ====================

  @Post('share')
  @ApiOperation({ summary: 'Share a report with user or role' })
  shareReport(@Body() dto: ShareReportDto, @Request() req) {
    return this.reportsService.shareReport(dto, req.user.userId);
  }

  // ==================== FAVORITES ====================

  @Post('favorites/:templateId')
  @ApiOperation({ summary: 'Add report to favorites' })
  addToFavorites(@Param('templateId') templateId: string, @Request() req) {
    return this.reportsService.addToFavorites(templateId, req.user.userId);
  }

  @Delete('favorites/:templateId')
  @ApiOperation({ summary: 'Remove report from favorites' })
  removeFromFavorites(@Param('templateId') templateId: string, @Request() req) {
    return this.reportsService.removeFromFavorites(templateId, req.user.userId);
  }

  @Get('favorites')
  @ApiOperation({ summary: 'Get user favorite reports' })
  getFavorites(@Request() req) {
    return this.reportsService.getFavorites(req.user.userId);
  }
}
