import { IsEmail, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'admin@jsc.gov.ng' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: 'password123' })
  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  password: string;

  @ApiProperty({ required: false, example: '123456', description: 'TOTP code for 2FA (if enabled/enforced)' })
  @IsOptional()
  @IsString()
  totp_code?: string;

  @ApiProperty({ required: false, example: '123456', description: 'Alias for totp_code' })
  @IsOptional()
  @IsString()
  totpCode?: string;
}
