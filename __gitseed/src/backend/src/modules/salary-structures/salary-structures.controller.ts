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
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { SalaryStructuresService } from './salary-structures.service';
import { RolesGuard } from '@common/guards/roles.guard';
import { Roles } from '@common/decorators/roles.decorator';

@ApiTags('Salary Structures')
@ApiBearerAuth()
@Controller('salary-structures')
@UseGuards(RolesGuard)
export class SalaryStructuresController {
  constructor(private readonly salaryStructuresService: SalaryStructuresService) {}

  @Post()
  @Roles('admin', 'hr_manager')
  @ApiOperation({ summary: 'Create salary structure' })
  @ApiResponse({ status: 201, description: 'Salary structure created successfully' })
  create(@Body() dto: any, @Request() req) {
    return this.salaryStructuresService.create(dto, req.user.userId);
  }

  @Get()
  @ApiOperation({ summary: 'Get all salary structures' })
  @ApiResponse({ status: 200, description: 'List of salary structures with pagination' })
  findAll(@Query() query: any) {
    return this.salaryStructuresService.findAll(query);
  }

  @Get('active')
  @ApiOperation({ summary: 'Get active salary structure' })
  @ApiResponse({ status: 200, description: 'Active salary structure found' })
  @ApiResponse({ status: 404, description: 'No active salary structure found' })
  getActive() {
    return this.salaryStructuresService.getActiveStructure();
  }

  @Get('code/:code')
  @ApiOperation({ summary: 'Get salary structure by code' })
  @ApiResponse({ status: 200, description: 'Salary structure found' })
  @ApiResponse({ status: 404, description: 'Salary structure not found' })
  findByCode(@Param('code') code: string) {
    return this.salaryStructuresService.findByCode(code);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get salary structure by ID' })
  @ApiResponse({ status: 200, description: 'Salary structure found' })
  @ApiResponse({ status: 404, description: 'Salary structure not found' })
  findOne(@Param('id') id: string) {
    return this.salaryStructuresService.findOne(id);
  }

  @Get(':id/salary/:gradeLevel/:step')
  @ApiOperation({ summary: 'Get salary for specific grade level and step' })
  @ApiResponse({ status: 200, description: 'Salary information retrieved' })
  @ApiResponse({ status: 404, description: 'Grade level or step not found' })
  getSalary(
    @Param('id') id: string,
    @Param('gradeLevel') gradeLevel: string,
    @Param('step') step: string,
  ) {
    return this.salaryStructuresService.getSalaryForGradeAndStep(
      id,
      gradeLevel,
      parseInt(step),
    );
  }

  @Patch(':id')
  @Roles('admin', 'hr_manager')
  @ApiOperation({ summary: 'Update salary structure' })
  @ApiResponse({ status: 200, description: 'Salary structure updated successfully' })
  update(@Param('id') id: string, @Body() dto: any, @Request() req) {
    return this.salaryStructuresService.update(id, dto, req.user.userId);
  }

  @Delete(':id')
  @Roles('admin')
  @ApiOperation({ summary: 'Deactivate salary structure (soft delete)' })
  @ApiResponse({ status: 200, description: 'Salary structure deactivated successfully' })
  remove(@Param('id') id: string, @Request() req) {
    return this.salaryStructuresService.remove(id, req.user.userId);
  }

  @Delete(':id/permanent')
  @Roles('admin')
  @ApiOperation({ summary: 'Permanently delete salary structure (hard delete)' })
  @ApiResponse({ status: 200, description: 'Salary structure permanently deleted' })
  hardDelete(@Param('id') id: string, @Request() req) {
    return this.salaryStructuresService.hardDelete(id, req.user.userId);
  }
}
