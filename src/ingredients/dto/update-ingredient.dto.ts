import { PartialType } from '@nestjs/mapped-types';
import { CreateIngredientDto } from './create-ingredient.dto';
import { IsEnum, IsNumber, IsOptional, IsString, IsUrl, Min } from 'class-validator';
import { IngredientCategory } from '../entities/ingredient.entity';

export class UpdateIngredientDto extends PartialType(CreateIngredientDto) {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(IngredientCategory)
  @IsOptional()
  category?: IngredientCategory;

  @IsString({ each: true })
  @IsOptional()
  alternativeNames?: string[];

  @IsNumber()
  @Min(0)
  @IsOptional()
  calories?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  protein?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  carbs?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  fat?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  fiber?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  sugar?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  sodium?: number;

  @IsUrl()
  @IsOptional()
  imageUrl?: string;

  @IsOptional()
  isCommon?: boolean;
}
