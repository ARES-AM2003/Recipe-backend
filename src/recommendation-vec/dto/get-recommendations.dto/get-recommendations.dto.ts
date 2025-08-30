// src/recommendation-vec/dto/get-recommendation.dto.ts
import { IsOptional, IsEnum, IsArray, IsNumber } from 'class-validator';
import {
  DifficultyLevel,
  CuisineType,
  MealType,
} from 'src/recipes/entities/recipe.entity';

export class GetRecommendationDto {
  @IsOptional()
  @IsEnum(DifficultyLevel)
  difficulty?: DifficultyLevel;

  @IsOptional()
  @IsEnum(CuisineType)
  cuisine?: CuisineType;

  @IsOptional()
  @IsEnum(MealType)
  mealType?: MealType;

  @IsOptional()
  @IsNumber()
  maxPrepTime?: number;

  @IsOptional()
  @IsNumber()
  minRating?: number;

  @IsOptional()
  @IsArray()
  tags?: string[];
}
