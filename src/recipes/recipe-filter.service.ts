import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder, Brackets } from 'typeorm';
import { Recipe } from './entities/recipe.entity';
import { Ingredient } from '../ingredients/entities/ingredient.entity';
import {
  FilterRecipesDto,
  TimeCategory,
  SortOption,
} from './dto/filter-recipes.dto';

export interface FilteredRecipesResult {
  data: Recipe[];
  total: number;
  page: number;
  limit: number;
}

@Injectable()
export class RecipeFilterService {
  constructor(
    @InjectRepository(Recipe)
    private readonly recipesRepository: Repository<Recipe>,
    @InjectRepository(Ingredient)
    private readonly ingredientsRepository: Repository<Ingredient>,
  ) {}

  async filterRecipes(
    filters: FilterRecipesDto,
  ): Promise<FilteredRecipesResult> {
    const queryBuilder = this.recipesRepository
      .createQueryBuilder('recipe')
      .leftJoinAndSelect('recipe.author', 'author')
      .leftJoinAndSelect('recipe.ingredients', 'ingredients');

    // Apply all filters conditionally
    this.applySearchFilter(queryBuilder, filters.search);
    this.applyCuisineFilter(queryBuilder, filters.cuisine);
    this.applyMealTypeFilter(queryBuilder, filters.mealType);
    this.applyDifficultyFilter(queryBuilder, filters.difficulty);
    this.applyTimeCategoryFilter(queryBuilder, filters.timeCategory);
    this.applyTimeRangeFilters(queryBuilder, filters);
    this.applyServingsFilter(queryBuilder, filters.servingsMin);
    await this.applyIngredientsIncludeFilter(
      queryBuilder,
      filters.ingredientsInclude,
    );
    await this.applyIngredientsExcludeFilter(
      queryBuilder,
      filters.ingredientsExclude,
    );
    this.applyNutritionFilters(queryBuilder, filters);
    this.applyRatingFilter(queryBuilder, filters.minRating);

    // Apply sorting
    this.applySorting(queryBuilder, filters.sort);

    // Apply pagination
    const page = filters.page || 1;
    const limit = filters.limit || 10;
    const skip = (page - 1) * limit;

    queryBuilder.skip(skip).take(limit);

    // Execute query
    const [data, total] = await queryBuilder.getManyAndCount();

    return {
      data,
      total,
      page,
      limit,
    };
  }

  private applySearchFilter(
    queryBuilder: SelectQueryBuilder<Recipe>,
    search?: string,
  ) {
    if (!search) return;

    queryBuilder.andWhere(
      new Brackets((qb) => {
        qb.where('LOWER(recipe.title) LIKE LOWER(:search)', {
          search: `%${search}%`,
        })
          .orWhere('LOWER(recipe.description) LIKE LOWER(:search)', {
            search: `%${search}%`,
          })
          .orWhere(
            "LOWER(array_to_string(recipe.tags, ',')) LIKE LOWER(:search)",
            { search: `%${search}%` },
          );
      }),
    );
  }

  private applyCuisineFilter(
    queryBuilder: SelectQueryBuilder<Recipe>,
    cuisine?: string[],
  ) {
    if (!cuisine || cuisine.length === 0) return;

    queryBuilder.andWhere('recipe.cuisine IN (:...cuisine)', { cuisine });
  }

  private applyMealTypeFilter(
    queryBuilder: SelectQueryBuilder<Recipe>,
    mealType?: string[],
  ) {
    if (!mealType || mealType.length === 0) return;

    queryBuilder.andWhere('recipe.mealType IN (:...mealType)', { mealType });
  }

  private applyDifficultyFilter(
    queryBuilder: SelectQueryBuilder<Recipe>,
    difficulty?: string[],
  ) {
    if (!difficulty || difficulty.length === 0) return;

    queryBuilder.andWhere('recipe.difficulty IN (:...difficulty)', {
      difficulty,
    });
  }

  private applyTimeCategoryFilter(
    queryBuilder: SelectQueryBuilder<Recipe>,
    timeCategory?: TimeCategory,
  ) {
    if (!timeCategory) return;

    const totalTimeExpression = '(recipe.prepTime + recipe.cookTime)';

    switch (timeCategory) {
      case TimeCategory.QUICK:
        queryBuilder.andWhere(`${totalTimeExpression} <= 30`);
        break;
      case TimeCategory.MODERATE:
        queryBuilder.andWhere(`${totalTimeExpression} BETWEEN 31 AND 60`);
        break;
      case TimeCategory.LONG:
        queryBuilder.andWhere(`${totalTimeExpression} > 60`);
        break;
    }
  }

  private applyTimeRangeFilters(
    queryBuilder: SelectQueryBuilder<Recipe>,
    filters: FilterRecipesDto,
  ) {
    if (filters.prepTimeMin !== undefined) {
      queryBuilder.andWhere('recipe.prepTime >= :prepTimeMin', {
        prepTimeMin: filters.prepTimeMin,
      });
    }

    if (filters.prepTimeMax !== undefined) {
      queryBuilder.andWhere('recipe.prepTime <= :prepTimeMax', {
        prepTimeMax: filters.prepTimeMax,
      });
    }

    if (filters.cookTimeMin !== undefined) {
      queryBuilder.andWhere('recipe.cookTime >= :cookTimeMin', {
        cookTimeMin: filters.cookTimeMin,
      });
    }

    if (filters.cookTimeMax !== undefined) {
      queryBuilder.andWhere('recipe.cookTime <= :cookTimeMax', {
        cookTimeMax: filters.cookTimeMax,
      });
    }
  }

  private applyServingsFilter(
    queryBuilder: SelectQueryBuilder<Recipe>,
    servingsMin?: number,
  ) {
    if (servingsMin === undefined) return;

    queryBuilder.andWhere('recipe.servings >= :servingsMin', { servingsMin });
  }

  private async applyIngredientsIncludeFilter(
    queryBuilder: SelectQueryBuilder<Recipe>,
    ingredientsInclude?: string[],
  ) {
    if (!ingredientsInclude || ingredientsInclude.length === 0) return;

    // Convert ingredient names to IDs if they are names
    const ingredientIds = await this.resolveIngredientIds(ingredientsInclude);

    if (ingredientIds.length === 0) return;

    // Recipe must include ALL specified ingredients
    queryBuilder
      .innerJoin('recipe.ingredients', 'includeIngredient')
      .andWhere('includeIngredient.id IN (:...ingredientIds)', {
        ingredientIds,
      })
      .groupBy('recipe.id')
      .addGroupBy('author.id')
      .having('COUNT(DISTINCT includeIngredient.id) = :requiredCount', {
        requiredCount: ingredientIds.length,
      });
  }

  private async applyIngredientsExcludeFilter(
    queryBuilder: SelectQueryBuilder<Recipe>,
    ingredientsExclude?: string[],
  ) {
    if (!ingredientsExclude || ingredientsExclude.length === 0) return;

    // Convert ingredient names to IDs if they are names
    const ingredientIds = await this.resolveIngredientIds(ingredientsExclude);

    if (ingredientIds.length === 0) return;

    // Recipe must NOT include ANY of the specified ingredients
    queryBuilder.andWhere(
      `recipe.id NOT IN (
        SELECT DISTINCT r.id
        FROM recipes r
        INNER JOIN recipe_ingredients ri ON r.id = ri."recipeId"
        WHERE ri."ingredientId" IN (:...excludeIngredientIds)
      )`,
      { excludeIngredientIds: ingredientIds },
    );
  }

  private async resolveIngredientIds(
    ingredientNamesOrIds: string[],
  ): Promise<string[]> {
    const resolvedIds: string[] = [];
    const potentialNames: string[] = [];

    // Separate UUIDs from potential names
    for (const item of ingredientNamesOrIds) {
      // Simple UUID check (36 characters with hyphens)
      if (item.length === 36 && item.includes('-')) {
        resolvedIds.push(item);
      } else {
        potentialNames.push(item);
      }
    }

    // Look up IDs for names
    if (potentialNames.length > 0) {
      const ingredients = await this.ingredientsRepository
        .createQueryBuilder('ingredient')
        .where('LOWER(ingredient.name) IN (:...names)', {
          names: potentialNames.map((name) => name.toLowerCase()),
        })
        .getMany();

      resolvedIds.push(...ingredients.map((ing) => ing.id));
    }

    return resolvedIds;
  }

  private applyNutritionFilters(
    queryBuilder: SelectQueryBuilder<Recipe>,
    filters: FilterRecipesDto,
  ) {
    if (filters.caloriesMin !== undefined) {
      queryBuilder.andWhere('recipe.calories >= :caloriesMin', {
        caloriesMin: filters.caloriesMin,
      });
    }

    if (filters.caloriesMax !== undefined) {
      queryBuilder.andWhere('recipe.calories <= :caloriesMax', {
        caloriesMax: filters.caloriesMax,
      });
    }

    if (filters.proteinMin !== undefined) {
      queryBuilder.andWhere('recipe.protein >= :proteinMin', {
        proteinMin: filters.proteinMin,
      });
    }

    if (filters.carbsMax !== undefined) {
      queryBuilder.andWhere('recipe.carbs <= :carbsMax', {
        carbsMax: filters.carbsMax,
      });
    }

    if (filters.fatMax !== undefined) {
      queryBuilder.andWhere('recipe.fat <= :fatMax', {
        fatMax: filters.fatMax,
      });
    }

    if (filters.fiberMin !== undefined) {
      queryBuilder.andWhere('recipe.fiber >= :fiberMin', {
        fiberMin: filters.fiberMin,
      });
    }

    if (filters.sugarMax !== undefined) {
      queryBuilder.andWhere('recipe.sugar <= :sugarMax', {
        sugarMax: filters.sugarMax,
      });
    }

    if (filters.sodiumMax !== undefined) {
      queryBuilder.andWhere('recipe.sodium <= :sodiumMax', {
        sodiumMax: filters.sodiumMax,
      });
    }
  }

  private applyRatingFilter(
    queryBuilder: SelectQueryBuilder<Recipe>,
    minRating?: number,
  ) {
    if (minRating === undefined) return;

    queryBuilder.andWhere('recipe.averageRating >= :minRating', { minRating });
  }

  private applySorting(
    queryBuilder: SelectQueryBuilder<Recipe>,
    sort?: SortOption,
  ) {
    const sortOption = sort || SortOption.NEWEST;

    switch (sortOption) {
      case SortOption.NEWEST:
        queryBuilder.orderBy('recipe.createdAt', 'DESC');
        break;
      case SortOption.OLDEST:
        queryBuilder.orderBy('recipe.createdAt', 'ASC');
        break;
      case SortOption.RATING_DESC:
        queryBuilder.orderBy('recipe.averageRating', 'DESC');
        break;
      case SortOption.RATING_ASC:
        queryBuilder.orderBy('recipe.averageRating', 'ASC');
        break;
      case SortOption.TIME_ASC:
        // Sort by total time using multi-column ordering to avoid DISTINCT/alias issues
        queryBuilder
          .orderBy('recipe.prepTime', 'ASC')
          .addOrderBy('recipe.cookTime', 'ASC');
        break;
      case SortOption.TIME_DESC:
        // Sort by total time using multi-column ordering to avoid DISTINCT/alias issues
        queryBuilder
          .orderBy('recipe.prepTime', 'DESC')
          .addOrderBy('recipe.cookTime', 'DESC');
        break;
      case SortOption.MOST_REVIEWED:
        queryBuilder.orderBy('recipe.reviewCount', 'DESC');
        break;
      default:
        queryBuilder.orderBy('recipe.createdAt', 'DESC');
    }

    // Add secondary sort by ID for consistent pagination
    queryBuilder.addOrderBy('recipe.id', 'ASC');
  }
}
