// src/recommendation-vec/dto/get-recommendation.dto.ts
import { IsOptional, IsEnum, IsArray, IsNumber } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  DifficultyLevel,
  CuisineType,
  MealType,
} from 'src/recipes/entities/recipe.entity';

export class GetRecommendationDto {
  @ApiProperty({
    description: 'Filter by difficulty level',
    enum: DifficultyLevel,
    required: false,
  })
  @IsOptional()
  @IsEnum(DifficultyLevel)
  difficulty?: DifficultyLevel;

  @ApiProperty({
    description: 'Filter by cuisine type',
    enum: CuisineType,
    required: false,
  })
  @IsOptional()
  @IsEnum(CuisineType)
  cuisine?: CuisineType;

  @ApiProperty({
    description: 'Filter by meal type',
    enum: MealType,
    required: false,
  })
  @IsOptional()
  @IsEnum(MealType)
  mealType?: MealType;

  @ApiProperty({
    description:
      'Maximum total time in minutes (prepTime + cookTime). Use 30 for quick recipes.',
    example: 30,
    required: false,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  maxPrepTime?: number;

  @ApiProperty({
    description: 'Minimum average rating (0-5)',
    example: 4.0,
    required: false,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  minRating?: number;

  @ApiProperty({
    description: 'Filter by tags',
    type: [String],
    required: false,
  })
  @IsOptional()
  @IsArray()
  tags?: string[];

  @ApiProperty({
    description: 'Minimum cosine similarity threshold (0-1)',
    example: 0.35,
    required: false,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  minCosineSimilarity?: number;
}
