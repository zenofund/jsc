import { Controller, Get, Post, Body, Param, Query, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuditService } from './audit.service';
import { CreateAuditDto, AuditAction } from './dto/audit.dto';

@ApiTags('Audit Trail')
@ApiBearerAuth()
@Controller('audit')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Post()
  @ApiOperation({ summary: 'Log an audit trail entry' })
  log(@Body() dto: CreateAuditDto) {
    return this.auditService.log(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get audit trail with filters' })
  findAll(
    @Query('userId') userId?: string,
    @Query('action') action?: AuditAction,
    @Query('entity') entity?: string,
    @Query('entityId') entityId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.auditService.findAll({
      userId,
      action,
      entity,
      entityId,
      startDate,
      endDate,
      page: page ? parseInt(String(page)) : 1,
      limit: limit ? parseInt(String(limit)) : 50,
    });
  }

  @Get('entity/:entity/:entityId')
  @ApiOperation({ summary: 'Get audit trail for a specific entity' })
  findByEntity(@Param('entity') entity: string, @Param('entityId') entityId: string) {
    return this.auditService.findByEntity(entity, entityId);
  }

  @Get('user/:userId/activity')
  @ApiOperation({ summary: 'Get user activity' })
  getUserActivity(@Param('userId') userId: string, @Query('limit') limit?: number) {
    return this.auditService.getUserActivity(userId, limit ? parseInt(String(limit)) : 50);
  }

  @Get('statistics')
  @ApiOperation({ summary: 'Get audit statistics' })
  getStatistics(@Query('startDate') startDate?: string, @Query('endDate') endDate?: string) {
    return this.auditService.getStatistics(startDate, endDate);
  }
}
