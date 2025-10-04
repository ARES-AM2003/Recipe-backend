import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not } from 'typeorm';
import { PantryItem } from './entities/pantry-item.entity';
import { User } from '../users/entities/user.entity';
import { Ingredient } from '../ingredients/entities/ingredient.entity';
import { AddPantryItemDto } from './dto/add-pantry-item.dto';
import { UpdatePantryItemDto } from './dto/update-pantry-item.dto';

@Injectable()
export class PantryService {
  constructor(
    @InjectRepository(PantryItem)
    private readonly pantryItemRepository: Repository<PantryItem>,
    @InjectRepository(Ingredient)
    private readonly ingredientRepository: Repository<Ingredient>,
  ) {}

  async addItem(user: User, addPantryItemDto: AddPantryItemDto) {
    const { ingredientId, expiryDate, note, ...pantryItemData } =
      addPantryItemDto;

    // Check if the ingredient exists
    const ingredient = await this.ingredientRepository.findOne({
      where: { id: ingredientId },
    });

    if (!ingredient) {
      throw new NotFoundException(
        `Ingredient with ID "${ingredientId}" not found`,
      );
    }

    // Check if the user already has this ingredient in their pantry
    const existingItem = await this.pantryItemRepository.findOne({
      where: {
        user: { id: user.id },
        ingredient: { id: ingredientId },
      },
    });

    if (existingItem) {
      throw new BadRequestException(
        'This ingredient is already in your pantry',
      );
    }

    const pantryItem = this.pantryItemRepository.create({
      ...pantryItemData,
      user,
      ingredient,
    });

    // Handle optional fields explicitly
    if (note) {
      pantryItem.note = note;
    }

    if (expiryDate) {
      pantryItem.expiryDate = new Date(expiryDate);
    }

    return this.pantryItemRepository.save(pantryItem);
  }

  async findAll(
    userId: string,
    page = 1,
    limit = 10,
    filter?: {
      ingredientIds?: string[];
      categories?: string[];
      isFavorite?: boolean;
      expiringSoon?: boolean;
    },
  ) {
    const skip = (page - 1) * limit;

    const query = this.pantryItemRepository
      .createQueryBuilder('pantryItem')
      .leftJoinAndSelect('pantryItem.ingredient', 'ingredient')
      .where('pantryItem.userId = :userId', { userId })
      .orderBy('pantryItem.expiryDate', 'ASC')
      .skip(skip)
      .take(limit);

    if (filter) {
      if (filter.ingredientIds?.length) {
        query.andWhere('pantryItem.ingredientId IN (:...ingredientIds)', {
          ingredientIds: filter.ingredientIds,
        });
      }

      if (filter.categories?.length) {
        query.andWhere('ingredient.category IN (:...categories)', {
          categories: filter.categories,
        });
      }

      if (filter.isFavorite !== undefined) {
        query.andWhere('pantryItem.isFavorite = :isFavorite', {
          isFavorite: filter.isFavorite,
        });
      }

      if (filter.expiringSoon) {
        const date = new Date();
        date.setDate(date.getDate() + 7); // Next 7 days
        query.andWhere('pantryItem.expiryDate <= :date', { date });
      }
    }

    const [data, count] = await query.getManyAndCount();
    return { data, count };
  }

  async findOne(userId: string, id: string) {
    const pantryItem = await this.pantryItemRepository.findOne({
      where: { id, user: { id: userId } },
      relations: ['ingredient'],
    });

    if (!pantryItem) {
      throw new NotFoundException(
        `Pantry item with ID "${id}" not found in your pantry`,
      );
    }

    return pantryItem;
  }

  async update(
    userId: string,
    id: string,
    updatePantryItemDto: UpdatePantryItemDto,
  ) {
    const pantryItem = await this.findOne(userId, id);

    if (updatePantryItemDto.ingredientId) {
      const ingredient = await this.ingredientRepository.findOne({
        where: { id: updatePantryItemDto.ingredientId },
      });

      if (!ingredient) {
        throw new NotFoundException(
          `Ingredient with ID "${updatePantryItemDto.ingredientId}" not found`,
        );
      }

      // Check if updating to this ingredient would cause a duplicate
      const existingItem = await this.pantryItemRepository.findOne({
        where: {
          user: { id: userId },
          ingredient: { id: updatePantryItemDto.ingredientId },
          id: Not(id), // Exclude current item
        },
      });

      if (existingItem) {
        throw new BadRequestException(
          'This ingredient is already in your pantry',
        );
      }

      pantryItem.ingredient = ingredient;
    }

    // Handle expiryDate conversion
    if (updatePantryItemDto.expiryDate !== undefined) {
      if (updatePantryItemDto.expiryDate) {
        pantryItem.expiryDate = new Date(updatePantryItemDto.expiryDate);
      } else {
        pantryItem.expiryDate = null;
      }
    }

    // Handle note field explicitly
    if (updatePantryItemDto.note !== undefined) {
      if (updatePantryItemDto.note) {
        pantryItem.note = updatePantryItemDto.note;
      } else {
        pantryItem.note = null;
      }
    }

    // Apply other updates (excluding already handled fields)
    const { expiryDate, note, ...otherUpdates } = updatePantryItemDto;
    Object.assign(pantryItem, otherUpdates);

    return this.pantryItemRepository.save(pantryItem);
  }

  async remove(userId: string, id: string) {
    const result = await this.pantryItemRepository.delete({
      id,
      user: { id: userId },
    });

    if (result.affected === 0) {
      throw new NotFoundException(
        `Pantry item with ID "${id}" not found in your pantry`,
      );
    }
  }

  async getPantrySummary(userId: string) {
    const pantryItems = await this.pantryItemRepository.find({
      where: { user: { id: userId } },
      relations: ['ingredient'],
    });

    const categories = new Set<string>();
    let expiringSoonCount = 0;
    const now = new Date();
    const soon = new Date();
    soon.setDate(now.getDate() + 7); // Next 7 days

    pantryItems.forEach((item) => {
      if (item.ingredient) {
        categories.add(item.ingredient.category);
      }

      if (item.expiryDate && new Date(item.expiryDate) <= soon) {
        expiringSoonCount++;
      }
    });

    return {
      totalItems: pantryItems.length,
      categories: Array.from(categories),
      favorites: pantryItems.filter((item) => item.isFavorite).length,
      expiringSoon: expiringSoonCount,
    };
  }
}
