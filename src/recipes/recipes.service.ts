import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, Brackets } from 'typeorm';
import { Recipe } from './entities/recipe.entity';
import { User } from '../users/entities/user.entity';
import {
  CreateRecipeDto,
  BulkCreateRecipeDto,
  BulkCreateRecipeResultDto,
} from './dto/create-recipe.dto';
import { UpdateRecipeDto } from './dto/update-recipe.dto';
import {
  BulkRecipeDto,
  BulkUploadResultDto,
} from './dto/bulk-upload-recipe.dto';
import { ExtractedRecipeDataDto } from './dto/extract-recipe-from-url.dto';
import {
  Ingredient,
  IngredientCategory,
} from '../ingredients/entities/ingredient.entity';

type RecipeRelations = {
  author?: boolean;
  ingredients?: boolean;
};

@Injectable()
export class RecipesService {
  constructor(
    @InjectRepository(Recipe)
    private readonly recipesRepository: Repository<Recipe>,
    @InjectRepository(Ingredient)
    private readonly ingredientsRepository: Repository<Ingredient>,
  ) {}

  private getDefaultRelations(relations: RecipeRelations = {}) {
    return {
      author: true,
      ingredients: true,
      ...relations,
    };
  }

  private async validateAndGetIngredients(ingredientIds: string[]) {
    if (!ingredientIds?.length) return [];

    const ingredients = await this.ingredientsRepository.find({
      where: { id: In(ingredientIds) },
    });

    if (ingredients.length !== new Set(ingredientIds).size) {
      const foundIds = new Set(ingredients.map((i) => i.id));
      const missingIds = ingredientIds.filter((id) => !foundIds.has(id));
      throw new BadRequestException(
        `Some ingredients were not found: ${missingIds.join(', ')}`,
      );
    }

    return ingredients;
  }

  async create(
    createRecipeDto: CreateRecipeDto,
    author: User,
  ): Promise<Recipe> {
    const { ingredients: ingredientsData, ...recipeData } = createRecipeDto;

    // Validate and get ingredient entities
    const ingredientIds =
      ingredientsData?.map((item) => item.ingredientId) || [];
    const ingredients = await this.validateAndGetIngredients(ingredientIds);

    // Create recipe with ingredients
    const recipe = this.recipesRepository.create({
      ...recipeData,
      author,
      ingredients,
    });

    return this.recipesRepository.save(recipe);
  }

  async bulkCreate(
    bulkCreateDto: BulkCreateRecipeDto,
    author: User,
  ): Promise<BulkCreateRecipeResultDto> {
    const result: BulkCreateRecipeResultDto = {
      successCount: 0,
      failureCount: 0,
      createdRecipeIds: [],
      errors: [],
      message: '',
    };

    for (let i = 0; i < bulkCreateDto.recipes.length; i++) {
      const recipeDto = bulkCreateDto.recipes[i];
      try {
        // Create the recipe
        const recipe = await this.create(recipeDto, author);

        result.successCount++;
        result.createdRecipeIds.push(recipe.id);
      } catch (error) {
        result.failureCount++;
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        result.errors.push({
          index: i,
          error: errorMessage,
        });
      }
    }

    result.message = `Processed ${bulkCreateDto.recipes.length} recipes. ${result.successCount} successful, ${result.failureCount} failed.`;

    return result;
  }

  async findAll(
    page = 1,
    limit = 10,
  ): Promise<{ data: (Recipe & { likedCount: number })[]; count: number }> {
    // Get recipes with like counts in a single optimized query
    const recipesWithLikeCounts = await this.recipesRepository
      .createQueryBuilder('recipe')
      .leftJoinAndSelect('recipe.author', 'author')
      .leftJoinAndSelect('recipe.ingredients', 'ingredients')
      .leftJoin('recipe.likedBy', 'likedBy')
      .select([
        'recipe',
        'author.id',
        'author.name',
        'author.email',
        'ingredients.id',
        'ingredients.name',
        'ingredients.category',
      ])
      .addSelect('COUNT(likedBy.id)', 'likedCount')
      .groupBy('recipe.id, author.id, ingredients.id')
      .orderBy('recipe.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getRawAndEntities();

    // Get total count
    const totalCount = await this.recipesRepository.count();

    // Map the results to include likedCount
    const recipesWithLikeCount = recipesWithLikeCounts.entities.map(
      (recipe, index) => ({
        ...recipe,
        likedCount: parseInt(recipesWithLikeCounts.raw[index].likedCount) || 0,
      }),
    );

    return { data: recipesWithLikeCount, count: totalCount };
  }

  async findOne(
    id: string,
    relations: RecipeRelations = {},
  ): Promise<Recipe & { likedCount: number }> {
    const recipe = await this.recipesRepository.findOne({
      where: { id },
      relations: this.getDefaultRelations(relations),
    });

    if (!recipe) {
      throw new NotFoundException(`Recipe with ID "${id}" not found`);
    }

    // Get the liked count
    const likedCount = await this.recipesRepository
      .createQueryBuilder('recipe')
      .leftJoin('recipe.likedBy', 'likedBy')
      .where('recipe.id = :id', { id })
      .select('COUNT(likedBy.id)', 'count')
      .getRawOne();

    return {
      ...recipe,
      likedCount: parseInt(likedCount.count) || 0,
    };
  }

  async update(
    id: string,
    updateRecipeDto: UpdateRecipeDto,
    userId: string,
  ): Promise<Recipe> {
    const recipe = await this.findOne(id);

    // Check if the user is the author
    if (recipe.author.id !== userId) {
      throw new BadRequestException('You can only update your own recipes');
    }

    const { ingredients: ingredientsData, ...recipeData } = updateRecipeDto;

    // Update ingredients if provided
    if (ingredientsData) {
      const ingredientIds = ingredientsData.map((item) => item.ingredientId);
      const ingredients = await this.validateAndGetIngredients(ingredientIds);
      recipe.ingredients = ingredients;
    }

    // Update other recipe data
    Object.assign(recipe, recipeData);

    return this.recipesRepository.save(recipe);
  }

  async remove(id: string, userId: string): Promise<void> {
    const recipe = await this.findOne(id);

    // Check if the user is the author or an admin
    if (recipe.author.id !== userId) {
      throw new BadRequestException('You can only delete your own recipes');
    }

    await this.recipesRepository.remove(recipe);
  }

  async likeRecipe(
    recipeId: string,
    userId: string,
  ): Promise<{ recipe: Recipe; isLiked: boolean; message: string }> {
    const recipe = await this.recipesRepository.findOne({
      where: { id: recipeId },
      relations: ['likedBy', 'author'],
    });

    if (!recipe) {
      throw new NotFoundException(`Recipe with ID "${recipeId}" not found`);
    }

    // Check if the user has already liked the recipe
    const userAlreadyLiked = recipe.likedBy.some((user) => user.id === userId);

    if (userAlreadyLiked) {
      // Unlike the recipe
      recipe.likedBy = recipe.likedBy.filter((user) => user.id !== userId);
      await this.recipesRepository.save(recipe);

      return {
        recipe,
        isLiked: false,
        message: 'Recipe unliked successfully',
      };
    } else {
      // Like the recipe - add user to likedBy array
      const user = { id: userId } as any; // We only need the id for the relationship
      recipe.likedBy.push(user);
      await this.recipesRepository.save(recipe);

      return {
        recipe,
        isLiked: true,
        message: 'Recipe liked successfully',
      };
    }
  }

  async getLikedRecipes(
    userId: string,
    page = 1,
    limit = 10,
  ): Promise<{ data: Recipe[]; count: number; totalPages: number }> {
    const [results, count] = await this.recipesRepository
      .createQueryBuilder('recipe')
      .leftJoinAndSelect('recipe.author', 'author')
      .leftJoinAndSelect('recipe.ingredients', 'ingredients')
      .leftJoin('recipe.likedBy', 'likedUser')
      .where('likedUser.id = :userId', { userId })
      .skip((page - 1) * limit)
      .take(limit)
      .orderBy('recipe.createdAt', 'DESC')
      .getManyAndCount();

    return {
      data: results,
      count,
      totalPages: Math.ceil(count / limit),
    };
  }

  async getRecipeLikes(recipeId: string): Promise<{
    likeCount: number;
    likedBy: { id: string; name: string; email: string }[];
  }> {
    const recipe = await this.recipesRepository.findOne({
      where: { id: recipeId },
      relations: ['likedBy'],
      select: {
        id: true,
        likedBy: {
          id: true,
          name: true,
          email: true,
        },
      },
    });

    if (!recipe) {
      throw new NotFoundException(`Recipe with ID "${recipeId}" not found`);
    }

    return {
      likeCount: recipe.likedBy.length,
      likedBy: recipe.likedBy,
    };
  }

  async checkIfUserLikedRecipe(
    recipeId: string,
    userId: string,
  ): Promise<{ isLiked: boolean }> {
    const recipe = await this.recipesRepository
      .createQueryBuilder('recipe')
      .leftJoin('recipe.likedBy', 'likedUser')
      .where('recipe.id = :recipeId', { recipeId })
      .andWhere('likedUser.id = :userId', { userId })
      .getOne();

    return {
      isLiked: !!recipe,
    };
  }

  async searchRecipes(query: string, page = 1, limit = 10) {
    const searchResults = await this.recipesRepository
      .createQueryBuilder('recipe')
      .leftJoinAndSelect('recipe.author', 'author')
      .leftJoinAndSelect('recipe.ingredients', 'ingredients')
      .leftJoin('recipe.likedBy', 'likedBy')
      .select([
        'recipe',
        'author.id',
        'author.name',
        'author.email',
        'ingredients.id',
        'ingredients.name',
        'ingredients.category',
      ])
      .addSelect('COUNT(likedBy.id)', 'likedCount')
      .where(
        new Brackets((qb) => {
          qb.where('LOWER(recipe.title) LIKE LOWER(:query)', {
            query: `%${query}%`,
          })
            .orWhere('LOWER(recipe.description) LIKE LOWER(:query)', {
              query: `%${query}%`,
            })
            .orWhere('LOWER(ingredients.name) LIKE LOWER(:query)', {
              query: `%${query}%`,
            })
            .orWhere('LOWER(recipe.cuisine::text) LIKE LOWER(:query)', {
              query: `%${query}%`,
            }) // cast to text
            .orWhere('LOWER(recipe.tags) LIKE LOWER(:query)', {
              query: `%${query}%`,
            });
        }),
      )
      .groupBy('recipe.id, author.id, ingredients.id')
      .skip((page - 1) * limit)
      .take(limit)
      .orderBy('recipe.createdAt', 'DESC')
      .getRawAndEntities();

    // Get total count for pagination
    const totalCount = await this.recipesRepository
      .createQueryBuilder('recipe')
      .leftJoin('recipe.ingredients', 'ingredients')
      .where(
        new Brackets((qb) => {
          qb.where('LOWER(recipe.title) LIKE LOWER(:query)', {
            query: `%${query}%`,
          })
            .orWhere('LOWER(recipe.description) LIKE LOWER(:query)', {
              query: `%${query}%`,
            })
            .orWhere('LOWER(ingredients.name) LIKE LOWER(:query)', {
              query: `%${query}%`,
            })
            .orWhere('LOWER(recipe.cuisine::text) LIKE LOWER(:query)', {
              query: `%${query}%`,
            })
            .orWhere('LOWER(recipe.tags) LIKE LOWER(:query)', {
              query: `%${query}%`,
            });
        }),
      )
      .getCount();

    // Map the results to include likedCount
    const resultsWithLikeCount = searchResults.entities.map(
      (recipe, index) => ({
        ...recipe,
        likedCount: parseInt(searchResults.raw[index].likedCount) || 0,
      }),
    );

    return { data: resultsWithLikeCount, count: totalCount };
  }

  async findByIngredients(ingredientIds: string[], page = 1, limit = 10) {
    const searchResults = await this.recipesRepository
      .createQueryBuilder('recipe')
      .leftJoinAndSelect('recipe.author', 'author')
      .leftJoinAndSelect('recipe.ingredients', 'ingredients')
      .leftJoin('recipe.likedBy', 'likedBy')
      .innerJoin('recipe.ingredients', 'matchingIngredient')
      .select([
        'recipe',
        'author.id',
        'author.name',
        'author.email',
        'ingredients.id',
        'ingredients.name',
        'ingredients.category',
      ])
      .addSelect('COUNT(likedBy.id)', 'likedCount')
      .where('matchingIngredient.id IN (:...ingredientIds)', { ingredientIds })
      .groupBy('recipe.id, author.id, ingredients.id')
      .having('COUNT(DISTINCT matchingIngredient.id) = :ingredientCount', {
        ingredientCount: ingredientIds.length,
      })
      .skip((page - 1) * limit)
      .take(limit)
      .orderBy('recipe.createdAt', 'DESC')
      .getRawAndEntities();

    // Get total count for pagination
    const totalCount = await this.recipesRepository
      .createQueryBuilder('recipe')
      .innerJoin('recipe.ingredients', 'ingredient')
      .where('ingredient.id IN (:...ingredientIds)', { ingredientIds })
      .groupBy('recipe.id')
      .having('COUNT(DISTINCT ingredient.id) = :ingredientCount', {
        ingredientCount: ingredientIds.length,
      })
      .getCount();

    // Map the results to include likedCount
    const resultsWithLikeCount = searchResults.entities.map(
      (recipe, index) => ({
        ...recipe,
        likedCount: parseInt(searchResults.raw[index].likedCount) || 0,
      }),
    );

    return { data: resultsWithLikeCount, count: totalCount };
  }

  async findMyRecipes(userId: string, page = 1, limit = 10) {
    // Get recipes with like counts in a single optimized query
    const myRecipesWithLikeCounts = await this.recipesRepository
      .createQueryBuilder('recipe')
      .leftJoinAndSelect('recipe.author', 'author')
      .leftJoinAndSelect('recipe.ingredients', 'ingredients')
      .leftJoin('recipe.likedBy', 'likedBy')
      .select([
        'recipe',
        'author.id',
        'author.name',
        'author.email',
        'ingredients.id',
        'ingredients.name',
        'ingredients.category',
      ])
      .addSelect('COUNT(likedBy.id)', 'likedCount')
      .where('recipe.authorId = :userId', { userId })
      .groupBy('recipe.id, author.id, ingredients.id')
      .orderBy('recipe.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getRawAndEntities();

    // Get total count
    const totalCount = await this.recipesRepository.count({
      where: { authorId: userId },
    });

    // Map the results to include likedCount
    const recipesWithLikeCount = myRecipesWithLikeCounts.entities.map(
      (recipe, index) => ({
        ...recipe,
        likedCount:
          parseInt(myRecipesWithLikeCounts.raw[index].likedCount) || 0,
      }),
    );

    return {
      data: recipesWithLikeCount,
      total: totalCount,
      page,
      limit,
      totalPages: Math.ceil(totalCount / limit),
    };
  }

  async bulkUploadRecipes(
    bulkRecipes: BulkRecipeDto[],
    author: User,
  ): Promise<BulkUploadResultDto> {
    const result: BulkUploadResultDto = {
      successCount: 0,
      failureCount: 0,
      createdRecipeIds: [],
      errors: [],
      message: '',
    };

    for (let i = 0; i < bulkRecipes.length; i++) {
      const bulkRecipe = bulkRecipes[i];
      try {
        // Convert bulk recipe to create recipe DTO
        const createRecipeDto =
          await this.convertBulkRecipeToCreateDto(bulkRecipe);

        // Create the recipe
        const recipe = await this.create(createRecipeDto, author);

        result.successCount++;
        result.createdRecipeIds.push(recipe.id);
      } catch (error) {
        result.failureCount++;
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        result.errors.push(`Row ${i + 2}: ${errorMessage}`);
      }
    }

    result.message = `Processed ${bulkRecipes.length} recipes. ${result.successCount} successful, ${result.failureCount} failed.`;

    return result;
  }

  private async convertBulkRecipeToCreateDto(
    bulkRecipe: BulkRecipeDto,
  ): Promise<CreateRecipeDto> {
    // Parse instructions from string (separated by semicolons)
    const instructions = bulkRecipe.instructions
      .split(';')
      .map((instruction) => instruction.trim())
      .filter((instruction) => instruction.length > 0);

    // Parse tags from string (separated by commas)
    const tags = bulkRecipe.tags
      ? bulkRecipe.tags
          .split(',')
          .map((tag) => tag.trim())
          .filter((tag) => tag.length > 0)
      : [];

    // Parse and find ingredients
    const ingredientNames = bulkRecipe.ingredients
      .split(',')
      .map((name) => name.trim().toLowerCase())
      .filter((name) => name.length > 0);

    // Find existing ingredients or create a note about missing ones
    const existingIngredients = await this.ingredientsRepository
      .createQueryBuilder('ingredient')
      .where('LOWER(ingredient.name) IN (:...names)', {
        names: ingredientNames,
      })
      .getMany();

    const foundIngredientNames = existingIngredients.map((ing) =>
      ing.name.toLowerCase(),
    );
    const missingIngredients = ingredientNames.filter(
      (name) => !foundIngredientNames.includes(name),
    );

    if (missingIngredients.length > 0) {
      throw new BadRequestException(
        `The following ingredients were not found in the database: ${missingIngredients.join(', ')}. ` +
          `Please add them to the ingredients database first or update the recipe.`,
      );
    }

    // Convert to CreateRecipeDto format
    const createRecipeDto: CreateRecipeDto = {
      title: bulkRecipe.title,
      description: bulkRecipe.description,
      difficulty: bulkRecipe.difficulty,
      instructions,
      prepTime: bulkRecipe.prepTime,
      cookTime: bulkRecipe.cookTime,
      servings: bulkRecipe.servings,
      cuisine: bulkRecipe.cuisine,
      mealType: bulkRecipe.mealType,
      tags,
      imageUrl: bulkRecipe.imageUrl,
      calories: bulkRecipe.calories,
      protein: bulkRecipe.protein,
      carbs: bulkRecipe.carbs,
      fat: bulkRecipe.fat,
      fiber: bulkRecipe.fiber,
      sugar: bulkRecipe.sugar,
      sodium: bulkRecipe.sodium,
      ingredients: existingIngredients.map((ingredient) => ({
        ingredientId: ingredient.id,
        amount: 1, // Default amount since not specified in bulk upload
        unit: 'piece', // Default unit since not specified in bulk upload
      })),
    };

    return createRecipeDto;
  }

  /**
   * Creates a recipe from extracted URL data
   * Handles ingredient matching and creation
   */
  async createRecipeFromExtractedData(
    extractedData: ExtractedRecipeDataDto,
    author: User,
  ): Promise<Recipe> {
    console.log('🔍 Processing ingredients from extracted data...');
    console.log(
      `📊 Total ingredients to process: ${extractedData.ingredients.length}`,
    );

    // Process ingredients sequentially to avoid race conditions with duplicates
    const processedIngredients: Array<{
      ingredientId: string;
      amount: number;
      unit: string;
      notes?: string;
    }> = [];
    const ingredientCache = new Map<string, string>(); // name -> id cache

    for (let index = 0; index < extractedData.ingredients.length; index++) {
      const ingredientData = extractedData.ingredients[index];
      const ingredientName = ingredientData.name.trim().toLowerCase();

      console.log(
        `\n🔎 [${index + 1}/${extractedData.ingredients.length}] Processing: "${ingredientName}"`,
      );
      console.log(`   Amount: ${ingredientData.amount} ${ingredientData.unit}`);
      if (ingredientData.notes) {
        console.log(`   Notes: ${ingredientData.notes}`);
      }

      // Check cache first (for duplicates in same recipe)
      if (ingredientCache.has(ingredientName)) {
        const cachedId = ingredientCache.get(ingredientName)!;
        console.log(
          `   ♻️  Found in cache (duplicate in this recipe): ID ${cachedId}`,
        );
        processedIngredients.push({
          ingredientId: cachedId,
          amount: ingredientData.amount,
          unit: ingredientData.unit,
          notes: ingredientData.notes,
        });
        continue;
      }

      // Try to find existing ingredient by name (case-insensitive)
      console.log(`   🔍 Searching database for existing ingredient...`);
      let existingIngredient = await this.ingredientsRepository
        .createQueryBuilder('ingredient')
        .where('LOWER(ingredient.name) = LOWER(:name)', {
          name: ingredientName,
        })
        .getOne();

      if (existingIngredient) {
        console.log(
          `   ✅ Found existing ingredient: "${existingIngredient.name}" (ID: ${existingIngredient.id})`,
        );
        console.log(`   📁 Category: ${existingIngredient.category}`);
        ingredientCache.set(ingredientName, existingIngredient.id);
        processedIngredients.push({
          ingredientId: existingIngredient.id,
          amount: ingredientData.amount,
          unit: ingredientData.unit,
          notes: ingredientData.notes,
        });
        continue;
      }

      // If ingredient doesn't exist, create it with error handling for race conditions
      console.log(`   ➕ Ingredient not found, creating new entry...`);
      try {
        const newIngredient = this.ingredientsRepository.create({
          name: ingredientName,
          category: IngredientCategory.OTHER,
        });
        const savedIngredient =
          await this.ingredientsRepository.save(newIngredient);

        console.log(
          `   ✅ Created new ingredient: "${savedIngredient.name}" (ID: ${savedIngredient.id})`,
        );
        console.log(`   📁 Category: ${savedIngredient.category}`);

        ingredientCache.set(ingredientName, savedIngredient.id);
        processedIngredients.push({
          ingredientId: savedIngredient.id,
          amount: ingredientData.amount,
          unit: ingredientData.unit,
          notes: ingredientData.notes,
        });
      } catch (error: any) {
        // Handle duplicate key error (race condition with another request)
        if (error.code === '23505') {
          console.log(
            `   ⚠️  Race condition detected, fetching existing ingredient...`,
          );
          // Fetch the ingredient that was created by another process
          existingIngredient = await this.ingredientsRepository
            .createQueryBuilder('ingredient')
            .where('LOWER(ingredient.name) = LOWER(:name)', {
              name: ingredientName,
            })
            .getOne();

          if (existingIngredient) {
            console.log(
              `   ✅ Found ingredient created by concurrent request: "${existingIngredient.name}" (ID: ${existingIngredient.id})`,
            );
            ingredientCache.set(ingredientName, existingIngredient.id);
            processedIngredients.push({
              ingredientId: existingIngredient.id,
              amount: ingredientData.amount,
              unit: ingredientData.unit,
              notes: ingredientData.notes,
            });
          } else {
            throw new Error(
              `Failed to create or find ingredient: ${ingredientName}`,
            );
          }
        } else {
          // Re-throw other errors
          throw error;
        }
      }
    }
    console.log(`\n✅ All ingredients processed successfully!`);
    console.log(
      `📊 Summary: ${processedIngredients.length} ingredients ready for recipe`,
    );

    // Map enum values to match database enum format
    const mapDifficulty = (difficulty: string | undefined): any => {
      if (!difficulty) return 'Easy';
      const normalized = difficulty.toUpperCase();
      switch (normalized) {
        case 'EASY':
          return 'Easy';
        case 'MEDIUM':
          return 'Medium';
        case 'HARD':
          return 'Hard';
        default:
          return 'Easy';
      }
    };

    const mapCuisine = (cuisine: string | undefined): any => {
      if (!cuisine) return 'Other';
      const normalized = cuisine.toUpperCase();
      switch (normalized) {
        case 'ITALIAN':
          return 'Italian';
        case 'MEXICAN':
          return 'Mexican';
        case 'INDIAN':
          return 'Indian';
        case 'CHINESE':
          return 'Chinese';
        case 'JAPANESE':
          return 'Japanese';
        case 'AMERICAN':
          return 'American';
        case 'MEDITERRANEAN':
          return 'Mediterranean';
        case 'THAI':
          return 'Thai';
        case 'FRENCH':
          return 'French';
        case 'NEPALESE':
          return 'Other'; // Map non-standard cuisines to Other
        case 'KOREAN':
          return 'Other';
        case 'VIETNAMESE':
          return 'Other';
        case 'OTHER':
          return 'Other';
        default:
          return 'Other';
      }
    };

    const mapMealType = (mealType: string | undefined): any => {
      if (!mealType) return 'Lunch';
      const normalized = mealType.toUpperCase();
      switch (normalized) {
        case 'BREAKFAST':
          return 'Breakfast';
        case 'LUNCH':
          return 'Lunch';
        case 'DINNER':
          return 'Dinner';
        case 'DESSERT':
          return 'Dessert';
        case 'SNACK':
          return 'Snack';
        case 'APPETIZER':
          return 'Appetizer';
        case 'BEVERAGE':
          return 'Beverage';
        default:
          return 'Lunch';
      }
    };

    // Clean up instructions formatting
    const cleanedInstructions = (extractedData.instructions || [])
      .map((instruction: string) => {
        if (!instruction || typeof instruction !== 'string') return '';

        let cleaned = instruction
          .trim()
          // Remove leading numbers and dots (1. 2. etc)
          .replace(/^\d+\.\s*/, '')
          // Remove leading bullets (-, *, •)
          .replace(/^[-*•]\s*/, '')
          // Remove multiple spaces
          .replace(/\s+/g, ' ')
          // Remove extra dots at end
          .replace(/\.+$/, '.')
          .trim();

        // Capitalize first letter
        if (cleaned.length > 0) {
          cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
        }

        // Add period if missing
        if (cleaned.length > 0 && !/[.!?]$/.test(cleaned)) {
          cleaned += '.';
        }

        return cleaned;
      })
      .filter((instruction: string) => instruction.length > 5); // Remove very short/empty instructions

    console.log(
      `\n📝 Instructions cleaned: ${cleanedInstructions.length} steps`,
    );
    if (cleanedInstructions.length > 0) {
      console.log(`   Sample: "${cleanedInstructions[0].substring(0, 80)}..."`);
    }

    // Create recipe DTO with properly mapped enum values
    const createRecipeDto: CreateRecipeDto = {
      title: extractedData.title,
      description: extractedData.description || extractedData.title,
      difficulty: mapDifficulty(extractedData.difficulty),
      instructions: cleanedInstructions,
      prepTime: extractedData.prepTime || 0,
      cookTime: extractedData.cookTime || 0,
      servings: extractedData.servings || 1,
      cuisine: mapCuisine(extractedData.cuisine),
      mealType: mapMealType(extractedData.mealType),
      tags: extractedData.tags || [],
      imageUrl: extractedData.imageUrl,
      ingredients: processedIngredients,
      calories: extractedData.calories || 0,
      protein: extractedData.protein || 0,
      carbs: extractedData.carbs || 0,
      fat: extractedData.fat || 0,
      fiber: extractedData.fiber || 0,
      sugar: extractedData.sugar || 0,
      sodium: extractedData.sodium || 0,
    };

    console.log('\n📝 Creating recipe in database...');
    console.log(`   Title: ${createRecipeDto.title}`);
    console.log(`   Difficulty: ${createRecipeDto.difficulty}`);
    console.log(`   Cuisine: ${createRecipeDto.cuisine}`);
    console.log(`   Meal Type: ${createRecipeDto.mealType}`);
    console.log(`   Ingredients: ${createRecipeDto.ingredients.length}`);
    console.log(
      `   Instructions: ${createRecipeDto.instructions?.length || 0} steps`,
    );

    // Create and save recipe
    const recipe = await this.create(createRecipeDto, author);

    console.log('✅ Recipe created successfully!');
    console.log(`   Recipe ID: ${recipe.id}`);
    console.log(`   Title: ${recipe.title}`);

    return recipe;
  }
}
