import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsOptional, Min, Max } from 'class-validator';

export class NutritionFiltersDto {
  @ApiProperty({
    description: 'Maximum calories per serving',
    required: false,
    type: Number,
    example: 500,
  })
  @IsNumber()
  @Min(0)
  @IsOptional()
  maxCalories?: number;

  @ApiProperty({
    description: 'Minimum protein per serving (in grams)',
    required: false,
    type: Number,
    example: 20,
  })
  @IsNumber()
  @Min(0)
  @IsOptional()
  minProtein?: number;

  @ApiProperty({
    description: 'Maximum carbohydrates per serving (in grams)',
    required: false,
    type: Number,
    example: 50,
  })
  @IsNumber()
  @Min(0)
  @IsOptional()
  maxCarbs?: number;

  @ApiProperty({
    description: 'Maximum fat per serving (in grams)',
    required: false,
    type: Number,
    example: 20,
  })
  @IsNumber()
  @Min(0)
  @IsOptional()
  maxFat?: number;

  @ApiProperty({
    description: 'Minimum fiber per serving (in grams)',
    required: false,
    type: Number,
    example: 5,
  })
  @IsNumber()
  @Min(0)
  @IsOptional()
  minFiber?: number;

  @ApiProperty({
    description: 'Maximum sugar per serving (in grams)',
    required: false,
    type: Number,
    example: 25,
  })
  @IsNumber()
  @Min(0)
  @IsOptional()
  maxSugar?: number;

  @ApiProperty({
    description: 'Maximum sodium per serving (in mg)',
    required: false,
    type: Number,
    example: 800,
  })
  @IsNumber()
  @Min(0)
  @IsOptional()
  maxSodium?: number;

  @ApiProperty({
    description: 'Dietary restrictions (e.g., vegetarian, vegan, gluten-free)',
    required: false,
    type: [String],
    example: ['vegetarian', 'gluten-free'],
  })
  @IsOptional()
  dietaryRestrictions?: string[];

  @ApiProperty({
    description: 'Allergens to exclude',
    required: false,
    type: [String],
    example: ['dairy', 'nuts'],
  })
  @IsOptional()
  excludeAllergens?: string[];

  @ApiProperty({
    description: 'Maximum preparation time in minutes',
    required: false,
    type: Number,
    example: 30,
  })
  @IsNumber()
  @Min(0)
  @IsOptional()
  maxPrepTime?: number;

  @ApiProperty({
    description: 'Maximum cooking time in minutes',
    required: false,
    type: Number,
    example: 60,
  })
  @IsNumber()
  @Min(0)
  @IsOptional()
  maxCookTime?: number;
}
