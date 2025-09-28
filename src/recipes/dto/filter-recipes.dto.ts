import {
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  Max,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import {
  CuisineType,
  DifficultyLevel,
  MealType,
} from '../entities/recipe.entity';

export enum TimeCategory {
  QUICK = 'quick',
  MODERATE = 'moderate',
  LONG = 'long',
}

export enum SortOption {
  NEWEST = 'newest',
  OLDEST = 'oldest',
  RATING_DESC = 'rating_desc',
  RATING_ASC = 'rating_asc',
  TIME_ASC = 'time_asc',
  TIME_DESC = 'time_desc',
  MOST_REVIEWED = 'most_reviewed',
}

export class FilterRecipesDto {
  // 🔍 Search & Basic
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsArray()
  @IsEnum(CuisineType, { each: true })
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.split(',').map((item) => item.trim()) as CuisineType[];
    }
    return Array.isArray(value) ? (value as CuisineType[]) : [];
  })
  cuisine?: CuisineType[];

  @IsOptional()
  @IsArray()
  @IsEnum(MealType, { each: true })
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.split(',').map((item) => item.trim()) as MealType[];
    }
    return Array.isArray(value) ? (value as MealType[]) : [];
  })
  mealType?: MealType[];

  @IsOptional()
  @IsArray()
  @IsEnum(DifficultyLevel, { each: true })
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.split(',').map((item) => item.trim()) as DifficultyLevel[];
    }
    return Array.isArray(value) ? (value as DifficultyLevel[]) : [];
  })
  difficulty?: DifficultyLevel[];

  // ⏱ Time Categories
  @IsOptional()
  @IsEnum(TimeCategory)
  timeCategory?: TimeCategory;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  prepTimeMin?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  prepTimeMax?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  cookTimeMin?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  cookTimeMax?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  servingsMin?: number;

  // 🥗 Ingredients
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.split(',').map((item) => item.trim());
    }
    return Array.isArray(value) ? (value as string[]) : [];
  })
  ingredientsInclude?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.split(',').map((item) => item.trim());
    }
    return Array.isArray(value) ? (value as string[]) : [];
  })
  ingredientsExclude?: string[];

  // 🥑 Nutrition Ranges
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  caloriesMin?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  caloriesMax?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  proteinMin?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  carbsMax?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  fatMax?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  fiberMin?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  sugarMax?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  sodiumMax?: number;

  // ⭐ Rating
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(5)
  @Type(() => Number)
  minRating?: number;

  // 📄 Pagination & Sorting
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  page?: number = 1;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number = 10;

  @IsOptional()
  @IsEnum(SortOption)
  sort?: SortOption = SortOption.NEWEST;
}
