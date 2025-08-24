import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';
import { UserRole } from '../../users/entities/user.entity';

export class RegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsEnum(UserRole, { each: true })
  role?: UserRole;

  @IsOptional()
  @IsString({ each: true })
  dietaryPreferences?: string[];

  @IsOptional()
  @IsString({ each: true })
  allergies?: string[];
}
