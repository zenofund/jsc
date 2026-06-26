import { Controller, Get, Post, Body, Param, Delete, Put, Patch, UseGuards, Request, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { AuthService } from '../auth/auth.service';
import { RolesGuard } from '@common/guards/roles.guard';
import { Roles } from '@common/decorators/roles.decorator';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
@UseGuards(RolesGuard)
export class UsersController {
  constructor(private readonly authService: AuthService) {}

  @Get()
  @Roles('admin')
  @ApiOperation({ summary: 'Get all users' })
  @ApiResponse({ status: 200, description: 'List of users retrieved successfully' })
  async getAllUsers() {
    return this.authService.getAllUsers();
  }

  @Get('permission-catalog')
  @Roles('admin')
  @ApiOperation({ summary: 'Get permission catalog and role templates' })
  @ApiResponse({ status: 200, description: 'Permission catalog retrieved successfully' })
  async getPermissionCatalog() {
    return this.authService.getPermissionCatalog();
  }

  @Post()
  @Roles('admin')
  @ApiOperation({ summary: 'Create new user' })
  @ApiResponse({ status: 201, description: 'User created successfully' })
  async createUser(@Body() createUserDto: any, @Request() req) {
    return this.authService.createUser(createUserDto, req.user.userId);
  }

  @Put(':id')
  @Roles('admin')
  @ApiOperation({ summary: 'Update user' })
  @ApiResponse({ status: 200, description: 'User updated successfully' })
  async updateUser(@Param('id') id: string, @Body() updateUserDto: any, @Request() req) {
    return this.authService.updateUser(id, updateUserDto, req.user.userId);
  }

  @Patch(':id/password')
  @Roles('admin')
  @ApiOperation({ summary: 'Set user password (Admin only)' })
  @ApiResponse({ status: 200, description: 'Password updated successfully' })
  async setUserPassword(@Param('id') id: string, @Body() body: any, @Request() req) {
    const newPassword = String(body?.newPassword || '').trim();
    const confirmPassword = String(body?.confirmPassword || '').trim();

    if (!newPassword) {
      throw new BadRequestException('New password is required');
    }
    if (newPassword !== confirmPassword) {
      throw new BadRequestException('New password and confirm password do not match');
    }

    const mustChangePassword = body?.must_change_password ?? body?.mustChangePassword ?? true;
    return this.authService.adminSetUserPassword(id, newPassword, req.user.userId, Boolean(mustChangePassword));
  }

  @Delete(':id')
  @Roles('admin')
  @ApiOperation({ summary: 'Delete user' })
  @ApiResponse({ status: 200, description: 'User deleted successfully' })
  async deleteUser(@Param('id') id: string, @Request() req) {
    return this.authService.deleteUser(id, req.user.userId);
  }
}
