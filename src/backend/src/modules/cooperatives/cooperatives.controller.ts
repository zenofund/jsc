import { Controller, Get, Post, Put, Delete, Body, Param, Query, Request, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CooperativesService } from './cooperatives.service';
import { CreateCooperativeDto } from './dto/create-cooperative.dto';
import { AddCooperativeMemberDto } from './dto/add-member.dto';
import { RecordContributionDto } from './dto/record-contribution.dto';
import { CooperativeMigrationImportDto } from './dto/migration-import.dto';

@ApiTags('Cooperatives')
@ApiBearerAuth()
@Controller('cooperatives')
export class CooperativesController {
  constructor(private readonly cooperativesService: CooperativesService) {}

  // ==================== COOPERATIVES ====================

  @Post()
  @ApiOperation({ summary: 'Create a new cooperative' })
  createCooperative(@Body() dto: CreateCooperativeDto, @Request() req) {
    return this.cooperativesService.createCooperative(dto, req.user.userId);
  }

  @Get()
  @ApiOperation({ summary: 'Get all cooperatives' })
  findAllCooperatives(@Query('status') status?: string) {
    return this.cooperativesService.findAllCooperatives(status);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get cooperative stats' })
  getCooperativeStats() {
    return this.cooperativesService.getCooperativeStats();
  }

  @Post('migration/import')
  @ApiOperation({ summary: 'Batch import cooperative migration data' })
  importMigrationData(@Body() dto: CooperativeMigrationImportDto, @Request() req) {
    return this.cooperativesService.importMigrationData(dto, req.user.userId);
  }

  @Get(':id/stats')
  @ApiOperation({ summary: 'Get single cooperative stats' })
  getCooperativeStatsById(@Param('id') id: string) {
    return this.cooperativesService.getCooperativeStatsById(id);
  }

  @Get('members')
  @ApiOperation({ summary: 'Get all cooperative members' })
  getAllMembers(@Query('staff_id') staffId?: string) {
    return this.cooperativesService.getAllMembers(staffId);
  }

  @Get('staff/:staffId/memberships')
  @ApiOperation({ summary: 'Get staff cooperative memberships' })
  getStaffCooperatives(@Param('staffId') staffId: string) {
    return this.cooperativesService.getStaffCooperatives(staffId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get cooperative by ID' })
  findOneCooperative(@Param('id') id: string) {
    return this.cooperativesService.findOneCooperative(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update cooperative' })
  updateCooperative(@Param('id') id: string, @Body() dto: Partial<CreateCooperativeDto>, @Request() req) {
    return this.cooperativesService.updateCooperative(id, dto, req.user.userId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete cooperative' })
  deleteCooperative(@Param('id') id: string) {
    return this.cooperativesService.deleteCooperative(id);
  }

  // ==================== MEMBERS ====================

  @Post('members')
  @ApiOperation({ summary: 'Add member to cooperative' })
  addMember(@Body() dto: AddCooperativeMemberDto, @Request() req) {
    return this.cooperativesService.addMember(dto, req.user.userId);
  }

  @Get(':cooperativeId/members')
  @ApiOperation({ summary: 'Get all members of a cooperative' })
  getCooperativeMembers(
    @Param('cooperativeId') cooperativeId: string,
    @Query('status') status?: string,
  ) {
    return this.cooperativesService.getCooperativeMembers(cooperativeId, status);
  }

  @Delete(':cooperativeId/members/:staffId')
  @ApiOperation({ summary: 'Remove member from cooperative' })
  removeMember(
    @Param('cooperativeId') cooperativeId: string,
    @Param('staffId') staffId: string,
    @Request() req,
  ) {
    return this.cooperativesService.removeMember(cooperativeId, staffId, req.user.userId);
  }

  // ==================== CONTRIBUTIONS ====================

  @Post('contributions')
  @ApiOperation({ summary: 'Record a contribution' })
  recordContribution(@Body() dto: RecordContributionDto, @Request() req) {
    return this.cooperativesService.recordContribution(dto, req.user.userId);
  }

  @Get('contributions/all')
  @ApiOperation({ summary: 'Get all contributions' })
  getAllContributions(@Query('cooperative_id') cooperativeId?: string) {
    // If cooperative_id is provided, use the service method to filter by it
    if (cooperativeId) {
      return this.cooperativesService.getCooperativeContributions(cooperativeId);
    }
    // If no cooperative_id, return all contributions (we need to add this capability to service if not exists, 
    // or reusing getCooperativeContributions with optional param if refactored, 
    // but for now let's just allow it or call a new service method)
    return this.cooperativesService.getAllContributions();
  }

  @Delete('contributions/:id')
  @ApiOperation({ summary: 'Delete contribution' })
  deleteContribution(@Param('id') id: string, @Request() req) {
    return this.cooperativesService.deleteContribution(id, req.user.userId);
  }

  @Get(':cooperativeId/contributions')
  @ApiOperation({ summary: 'Get contributions for a cooperative' })
  getCooperativeContributions(
    @Param('cooperativeId') cooperativeId: string,
    @Query('month') month?: string,
  ) {
    return this.cooperativesService.getCooperativeContributions(cooperativeId, month);
  }

  @Get('members/:memberId/contributions')
  @ApiOperation({ summary: 'Get member contribution history' })
  getMemberContributions(@Param('memberId') memberId: string) {
    return this.cooperativesService.getMemberContributions(memberId);
  }

  @Get('members/:memberId/statement')
  @ApiOperation({ summary: 'Get member statement' })
  getMemberStatement(@Param('memberId') memberId: string) {
    return this.cooperativesService.getMemberStatement(memberId);
  }

  @Post('withdrawals')
  @ApiOperation({ summary: 'Process withdrawal' })
  withdraw(@Body() dto: { memberId: string; amount: number; reason?: string }, @Request() req) {
    return this.cooperativesService.withdraw(dto, req.user.userId);
  }

  @Post(':id/dividends')
  @ApiOperation({ summary: 'Distribute dividends' })
  distributeDividends(@Param('id') id: string, @Body() dto: { totalAmount: number }, @Request() req) {
    return this.cooperativesService.distributeDividends(id, dto.totalAmount, req.user.userId);
  }

  @Get('members/:id')
  @ApiOperation({ summary: 'Get member by ID' })
  getMemberById(@Param('id') id: string) {
    return this.cooperativesService.getMemberById(id);
  }

  @Put('members/:id')
  @ApiOperation({ summary: 'Update member details' })
  updateMember(
    @Param('id') id: string,
    @Body() dto: Partial<AddCooperativeMemberDto> & { status?: string, suspension_reason?: string },
    @Request() req,
  ) {
    return this.cooperativesService.updateMember(id, dto, req.user.userId);
  }

  @Delete('members/:id')
  @ApiOperation({ summary: 'Delete member' })
  deleteMember(@Param('id') id: string) {
    return this.cooperativesService.deleteMember(id);
  }
}
