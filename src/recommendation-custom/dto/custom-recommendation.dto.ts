import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsArray, IsNumber, Min, Max } from 'class-validator';

export class CustomRecommendationRequestDto {
  @ApiProperty({
    description: 'Array of ingredient IDs to base recommendations on',
    example: ['123e4567-e89b-12d3-a456-426614174000'],
    required: false,
  })
  @IsOptional()
  @IsArray()
  ingredientIds?: string[];

  @ApiProperty({
    description: 'Maximum number of recommendations to return',
    example: 10,
    default: 10,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiProperty({
    description: 'Minimum cosine similarity score (0-1)',
    example: 0.6,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  minCosineSimilarity?: number;

  @ApiProperty({
    description: 'Maximum calories per serving',
    example: 500,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  maxCalories?: number;

  @ApiProperty({
    description: 'Minimum protein in grams',
    example: 20,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  minProtein?: number;

  @ApiProperty({
    description: 'Maximum carbohydrates in grams',
    example: 50,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  maxCarbs?: number;

  @ApiProperty({
    description: 'Maximum fat in grams',
    example: 20,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  maxFat?: number;
}

export class CustomRecommendationItemDto {
  @ApiProperty({
    description: 'The recommended recipe',
  })
  recipe: any; // Will be the Recipe entity

  @ApiProperty({
    description: 'Similarity score (0-1)',
    example: 0.85,
  })
  score: number;

  @ApiProperty({
    description: 'Explanation of why this recipe was recommended',
    example: 'High TF-IDF similarity based on ingredients',
  })
  reason: string;

  @ApiProperty({
    description: 'Type of recommendation algorithm used',
    example: 'custom-tfidf',
  })
  type: string;
}

export class CustomRecommendationMetadataDto {
  @ApiProperty({
    description: 'Total number of recommendations returned',
    example: 10,
  })
  totalRecommendations: number;

  @ApiProperty({
    description: 'Number of documents (recipes) in the TF-IDF corpus',
    example: 150,
  })
  corpusSize: number;

  @ApiProperty({
    description: 'Vocabulary size (unique terms)',
    example: 450,
  })
  vocabularySize: number;

  @ApiProperty({
    description: 'Processing time in milliseconds',
    example: 125,
  })
  processingTimeMs: number;

  @ApiProperty({
    description: 'Timestamp of when recommendations were generated',
  })
  timestamp: Date;
}

export class CustomRecommendationResponseDto {
  @ApiProperty({
    description: 'List of recommended recipes with scores',
  })
  recommendations: CustomRecommendationItemDto[];

  @ApiProperty({
    description: 'Metadata about the recommendation process',
  })
  metadata: CustomRecommendationMetadataDto;
}
