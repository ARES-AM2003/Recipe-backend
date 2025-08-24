import { IsEmail, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { UserRole } from '../entities/user.entity';

export class UpdateUserDto {
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MinLength(6)
  password?: string;

  @IsOptional()
  @IsString()
  name?: string;

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
