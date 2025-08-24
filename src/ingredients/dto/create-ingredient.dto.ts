import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, IsUrl, Min } from 'class-validator';
import { IngredientCategory } from '../entities/ingredient.entity';

export class CreateIngredientDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(IngredientCategory)
  category: IngredientCategory;

  @IsString({ each: true })
  @IsOptional()
  alternativeNames?: string[];

  // Nutrition per 100g
  @IsNumber()
  @Min(0)
  calories: number;

  @IsNumber()
  @Min(0)
  protein: number; // in grams

  @IsNumber()
  @Min(0)
  carbs: number; // in grams

  @IsNumber()
  @Min(0)
  fat: number; // in grams

  @IsNumber()
  @Min(0)
  fiber: number; // in grams

  @IsNumber()
  @Min(0)
  sugar: number; // in grams

  @IsNumber()
  @Min(0)
  sodium: number; // in mg

  @IsUrl()
  @IsOptional()
  imageUrl?: string;

  @IsOptional()
  isCommon?: boolean;
}
