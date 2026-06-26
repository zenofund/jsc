import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class TwoFactorSetupDto {
  @ApiProperty({ example: 'admin@jsc.gov.ng' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: 'password123' })
  @IsString()
  @IsNotEmpty()
  password: string;
}

export class TwoFactorEnableDto extends TwoFactorSetupDto {
  @ApiProperty({ example: '123456' })
  @IsString()
  @IsNotEmpty()
  totp_code: string;
}

