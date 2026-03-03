import { IsEmail, IsNotEmpty, IsNumber, IsString, IsBoolean, IsOptional, Min, Max } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateSmtpSettingDto {
  @ApiProperty({ description: 'SMTP host', example: 'smtp.gmail.com' })
  @IsString()
  @IsNotEmpty()
  host: string;

  @ApiProperty({ description: 'SMTP port', example: 587 })
  @IsNumber()
  @Min(1)
  @Max(65535)
  port: number;

  @ApiProperty({ description: 'Use SSL/TLS', example: false })
  @IsBoolean()
  secure: boolean;

  @ApiProperty({ description: 'SMTP username', example: 'noreply@jsc.gov.ng' })
  @IsString()
  @IsNotEmpty()
  username: string;

  @ApiProperty({ description: 'SMTP password', example: 'your-password' })
  @IsString()
  @IsNotEmpty()
  password: string;

  @ApiProperty({ description: 'From email address', example: 'noreply@jsc.gov.ng' })
  @IsEmail()
  @IsNotEmpty()
  fromEmail: string;

  @ApiProperty({ description: 'From name', example: 'JSC Payroll System' })
  @IsString()
  @IsNotEmpty()
  fromName: string;
}

export class UpdateSmtpSettingDto {
  @ApiProperty({ description: 'SMTP host', example: 'smtp.gmail.com', required: false })
  @IsString()
  @IsOptional()
  host?: string;

  @ApiProperty({ description: 'SMTP port', example: 587, required: false })
  @IsNumber()
  @Min(1)
  @Max(65535)
  @IsOptional()
  port?: number;

  @ApiProperty({ description: 'Use SSL/TLS', example: false, required: false })
  @IsBoolean()
  @IsOptional()
  secure?: boolean;

  @ApiProperty({ description: 'SMTP username', required: false })
  @IsString()
  @IsOptional()
  username?: string;

  @ApiProperty({ description: 'SMTP password', required: false })
  @IsString()
  @IsOptional()
  password?: string;

  @ApiProperty({ description: 'From email address', required: false })
  @IsEmail()
  @IsOptional()
  fromEmail?: string;

  @ApiProperty({ description: 'From name', required: false })
  @IsString()
  @IsOptional()
  fromName?: string;
}

export class TestSmtpDto {
  @ApiProperty({ description: 'SMTP host', example: 'smtp.gmail.com' })
  @IsString()
  @IsNotEmpty()
  host: string;

  @ApiProperty({ description: 'SMTP port', example: 587 })
  @IsNumber()
  port: number;

  @ApiProperty({ description: 'Use SSL/TLS', example: false })
  @IsBoolean()
  secure: boolean;

  @ApiProperty({ description: 'SMTP username' })
  @IsString()
  @IsNotEmpty()
  username: string;

  @ApiProperty({ description: 'SMTP password' })
  @IsString()
  @IsNotEmpty()
  password: string;

  @ApiProperty({ description: 'Test recipient email', required: false })
  @IsEmail()
  @IsOptional()
  testEmail?: string;
}
