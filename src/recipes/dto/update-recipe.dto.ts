import { PartialType } from '@nestjs/mapped-types';
import { CreateRecipeDto } from './create-recipe.dto';
import {
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

import { IsNotEmpty } from 'class-validator';
import { DifficultyLevel } from '../entities/recipe.entity';

export class UpdateIngredientAmountDto {
  @IsString()
  @IsNotEmpty()
  ingredientId: string;

  @IsNumber()
  @Min(0.1)
  amount: number;

  @IsString()
  @IsOptional()
  unit?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class UpdateRecipeDto extends PartialType(CreateRecipeDto) {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateIngredientAmountDto)
  @IsOptional()
  ingredients?: UpdateIngredientAmountDto[];

  @IsOptional()
  @IsEnum(DifficultyLevel)
  difficulty?: DifficultyLevel;

  @IsString()
  @IsOptional()
  imageUrl?: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  averageRating?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  reviewCount?: number;
}
