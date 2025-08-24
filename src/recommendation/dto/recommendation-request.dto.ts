import { IsArray, IsBoolean, IsNumber, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RecommendationRequestDto {
  @ApiProperty({
    description: 'List of ingredient IDs to use for content-based recommendations',
    required: false,
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  ingredientIds?: string[];

  @ApiProperty({
    description: 'Maximum number of recommendations to return',
    required: false,
    default: 10,
  })
  @IsNumber()
  @IsOptional()
  limit?: number = 10;

  @ApiProperty({
    description: 'Include content-based recommendations',
    required: false,
    default: true,
  })
  @IsBoolean()
  @IsOptional()
  includeContentBased?: boolean = true;

  @ApiProperty({
    description: 'Include collaborative filtering recommendations',
    required: false,
    default: true,
  })
  @IsBoolean()
  @IsOptional()
  includeCollaborative?: boolean = true;

  @ApiProperty({
    description: 'Include hybrid recommendations',
    required: false,
    default: true,
  })
  @IsBoolean()
  @IsOptional()
  includeHybrid?: boolean = true;

  @ApiProperty({
    description: 'Filter by maximum calories per serving',
    required: false,
  })
  @IsNumber()
  @IsOptional()
  maxCalories?: number;

  @ApiProperty({
    description: 'Filter by minimum protein per serving (in grams)',
    required: false,
  })
  @IsNumber()
  @IsOptional()
  minProtein?: number;

  @ApiProperty({
    description: 'Filter by maximum carbs per serving (in grams)',
    required: false,
  })
  @IsNumber()
  @IsOptional()
  maxCarbs?: number;

  @ApiProperty({
    description: 'Filter by maximum fat per serving (in grams)',
    required: false,
  })
  @IsNumber()
  @IsOptional()
  maxFat?: number;
}
