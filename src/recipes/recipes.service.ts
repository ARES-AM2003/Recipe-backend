import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, FindManyOptions, Brackets } from 'typeorm';
import { Recipe } from './entities/recipe.entity';
import { User } from '../users/entities/user.entity';
import { CreateRecipeDto } from './dto/create-recipe.dto';
import { UpdateRecipeDto } from './dto/update-recipe.dto';
import { Ingredient } from '../ingredients/entities/ingredient.entity';

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

  async findAll(
    page = 1,
    limit = 10,
  ): Promise<{ data: Recipe[]; count: number }> {
    const [data, count] = await this.recipesRepository.findAndCount({
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
    });

    return { data, count };
  }

  async findOne(id: string, relations: RecipeRelations = {}): Promise<Recipe> {
    const recipe = await this.recipesRepository.findOne({
      where: { id },
      relations: this.getDefaultRelations(relations),
    });

    if (!recipe) {
      throw new NotFoundException(`Recipe with ID "${id}" not found`);
    }

    return recipe;
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
      const ingredients = await this.validateAndGetIngredients(
        ingredientIds as string[],
      );
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

  async likeRecipe(recipeId: string, userId: string): Promise<Recipe> {
    const recipe = await this.findOne(recipeId);

    // In a real app, you might want to track likes in a separate table
    // This is a simplified version
    // recipe.likesCount = (recipe.likesCount || 0) + 1;

    return this.recipesRepository.save(recipe);
  }

  async searchRecipes(query: string, page = 1, limit = 10) {
    const [results, count] = await this.recipesRepository
      .createQueryBuilder('recipe')
      .leftJoinAndSelect('recipe.author', 'author')
      .leftJoinAndSelect('recipe.ingredients', 'ingredients')
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

      .skip((page - 1) * limit)
      .take(limit)
      .orderBy('recipe.createdAt', 'DESC')
      .getManyAndCount();

    return { data: results, count };
  }

  async findByIngredients(ingredientIds: string[], page = 1, limit = 10) {
    const [results, count] = await this.recipesRepository
      .createQueryBuilder('recipe')
      .innerJoin('recipe.ingredients', 'ingredient')
      .where('ingredient.id IN (:...ingredientIds)', { ingredientIds })
      .groupBy('recipe.id')
      .having('COUNT(DISTINCT ingredient.id) = :ingredientCount', {
        ingredientCount: ingredientIds.length,
      })
      .skip((page - 1) * limit)
      .take(limit)
      .orderBy('recipe.createdAt', 'DESC')
      .getManyAndCount();

    return { data: results, count };
  }

  async findMyRecipes(userId: string, page = 1, limit = 10) {
    const [results, count] = await this.recipesRepository.findAndCount({
      where: { authorId: userId },
      relations: ['author', 'ingredients'],
      skip: (page - 1) * limit, // skip previous pages
      take: limit, // limit per page
      order: { createdAt: 'DESC' }, // optional: sort newest first
    });

    return {
      data: results,
      total: count,
      page,
      limit,
      totalPages: Math.ceil(count / limit),
    };
  }
}
