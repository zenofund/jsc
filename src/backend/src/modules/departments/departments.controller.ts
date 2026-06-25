import { Controller, Get, Param, Put, Post, Body, Request, Delete } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { DepartmentsService } from './departments.service';

@ApiTags('Departments')
@ApiBearerAuth()
@Controller('departments')
export class DepartmentsController {
  constructor(private readonly departmentsService: DepartmentsService) {}

  @Post()
  @ApiOperation({ summary: 'Create department' })
  create(@Body() dto: any, @Request() req) {
    return this.departmentsService.create(dto, req.user?.userId);
  }

  @Get()
  @ApiOperation({ summary: 'Get all departments' })
  findAll() {
    return this.departmentsService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get department by ID' })
  findOne(@Param('id') id: string) {
    return this.departmentsService.findOne(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update department' })
  update(@Param('id') id: string, @Body() dto: any, @Request() req) {
    return this.departmentsService.update(id, dto, req.user?.userId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete department (soft delete)' })
  remove(@Param('id') id: string, @Request() req) {
    return this.departmentsService.remove(id, req.user?.userId);
  }
}
