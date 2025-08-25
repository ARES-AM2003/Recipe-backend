import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, In, Repository } from 'typeorm';
import { Ingredient } from './entities/ingredient.entity';
import { CreateIngredientDto } from './dto/create-ingredient.dto';
import { UpdateIngredientDto } from './dto/update-ingredient.dto';

@Injectable()
export class IngredientsService {
  constructor(
    @InjectRepository(Ingredient)
    private readonly ingredientsRepository: Repository<Ingredient>,
  ) {}

  async create(createIngredientDto: CreateIngredientDto): Promise<Ingredient> {
    // Check if ingredient with the same name already exists
    const existingIngredient = await this.ingredientsRepository.findOne({
      where: { name: ILike(createIngredientDto.name) },
    });

    if (existingIngredient) {
      throw new BadRequestException(
        `Ingredient with name "${createIngredientDto.name}" already exists`,
      );
    }

    const ingredient = this.ingredientsRepository.create(createIngredientDto);
    return this.ingredientsRepository.save(ingredient);
  }
  async bulkCreate(
    ingredients: Partial<CreateIngredientDto>[],
  ): Promise<Ingredient[]> {
    const savedIngredients: Ingredient[] = [];

    for (const ing of ingredients) {
      if (!ing.name) continue; // skip if name is missing

      // check if ingredient exists
      const exists = await this.ingredientsRepository.findOne({
        where: { name: ILike(ing.name) },
      });

      if (!exists) {
        const ingredient = this.ingredientsRepository.create(ing);
        savedIngredients.push(
          await this.ingredientsRepository.save(ingredient),
        );
      }
    }

    return savedIngredients;
  }

  async findAll(
    page = 1,
    limit = 10,
    search?: string,
    category?: string,
  ): Promise<{
    data: Ingredient[];
    count: number;
    page: number;
    totalPages: number;
  }> {
    const skip = (page - 1) * limit;
    const where: any = {};

    if (search) {
      where.name = ILike(`%${search}%`);
    }

    if (category) {
      where.category = category as any;
    }

    const [data, count] = await this.ingredientsRepository.findAndCount({
      where,
      skip,
      take: limit,
      order: { name: 'ASC' },
    });

    const totalPages = Math.ceil(count / limit);

    return { data, count, page, totalPages };
  }

  async findByIds(ids: string[]): Promise<Ingredient[]> {
    if (!ids.length) return [];
    return this.ingredientsRepository.find({
      where: { id: In(ids) },
    });
  }

  async findOne(id: string): Promise<Ingredient> {
    const ingredient = await this.ingredientsRepository.findOne({
      where: { id },
    });
    if (!ingredient) {
      throw new NotFoundException(`Ingredient with ID "${id}" not found`);
    }
    return ingredient;
  }

  async findByName(name: string): Promise<Ingredient | null> {
    return this.ingredientsRepository.findOne({
      where: { name: ILike(name) },
    });
  }

  async update(
    id: string,
    updateIngredientDto: UpdateIngredientDto,
  ): Promise<Ingredient> {
    const ingredient = await this.findOne(id);

    // Check if updating name would cause a duplicate
    if (
      updateIngredientDto.name &&
      updateIngredientDto.name !== ingredient.name
    ) {
      const existingIngredient = await this.findByName(
        updateIngredientDto.name,
      );
      if (existingIngredient) {
        throw new BadRequestException(
          `Ingredient with name "${updateIngredientDto.name}" already exists`,
        );
      }
    }

    Object.assign(ingredient, updateIngredientDto);
    return this.ingredientsRepository.save(ingredient);
  }

  async remove(id: string): Promise<void> {
    const result = await this.ingredientsRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Ingredient with ID "${id}" not found`);
    }
  }

  async search(query: string, limit = 10): Promise<Ingredient[]> {
    if (!query) {
      return [];
    }

    return this.ingredientsRepository.find({
      where: [
        { name: ILike(`%${query}%`) },
        { alternativeNames: ILike(`%${query}%`) },
      ],
      take: limit,
      order: { name: 'ASC' },
    });
  }

  async getCommonIngredients(): Promise<Ingredient[]> {
    return this.ingredientsRepository.find({
      where: { isCommon: true },
      order: { name: 'ASC' },
    });
  }

  async getCategories(): Promise<string[]> {
    const categories = await this.ingredientsRepository
      .createQueryBuilder('ingredient')
      .select('DISTINCT ingredient.category', 'category')
      .orderBy('ingredient.category', 'ASC')
      .getRawMany();

    return categories.map((c: { category: string }) => c.category);
  }

  async findByCategory(
    category: string,
    page = 1,
    limit = 50,
  ): Promise<{
    data: Ingredient[];
    count: number;
    page: number;
    totalPages: number;
    category: string;
  }> {
    const skip = (page - 1) * limit;

    const [data, count] = await this.ingredientsRepository.findAndCount({
      where: { category: category as any },
      skip,
      take: limit,
      order: { name: 'ASC' },
    });

    const totalPages = Math.ceil(count / limit);

    return { data, count, page, totalPages, category };
  }

  async getCommonIngredientsByCategory(
    category: string,
  ): Promise<Ingredient[]> {
    return this.ingredientsRepository.find({
      where: {
        category: category as any,
        isCommon: true,
      },
      order: { name: 'ASC' },
    });
  }

  async getCategoryStats(category: string): Promise<{
    category: string;
    totalCount: number;
    commonCount: number;
    averageCalories: number;
    averageProtein: number;
    averageCarbs: number;
    averageFat: number;
  }> {
    const ingredients = await this.ingredientsRepository.find({
      where: { category: category as any },
    });

    const commonIngredients = ingredients.filter((ing) => ing.isCommon);

    const totalCount = ingredients.length;
    const commonCount = commonIngredients.length;

    if (totalCount === 0) {
      return {
        category,
        totalCount: 0,
        commonCount: 0,
        averageCalories: 0,
        averageProtein: 0,
        averageCarbs: 0,
        averageFat: 0,
      };
    }

    const totalCalories = ingredients.reduce(
      (sum, ing) => sum + ing.calories,
      0,
    );
    const totalProtein = ingredients.reduce((sum, ing) => sum + ing.protein, 0);
    const totalCarbs = ingredients.reduce((sum, ing) => sum + ing.carbs, 0);
    const totalFat = ingredients.reduce((sum, ing) => sum + ing.fat, 0);

    return {
      category,
      totalCount,
      commonCount,
      averageCalories: Math.round((totalCalories / totalCount) * 100) / 100,
      averageProtein: Math.round((totalProtein / totalCount) * 100) / 100,
      averageCarbs: Math.round((totalCarbs / totalCount) * 100) / 100,
      averageFat: Math.round((totalFat / totalCount) * 100) / 100,
    };
  }
}
