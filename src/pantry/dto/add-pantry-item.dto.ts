import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { QuantityUnit } from '../entities/pantry-item.entity';

export class AddPantryItemDto {
  @IsString()
  @IsNotEmpty()
  ingredientId: string;

  @IsNumber()
  @Min(0.1)
  quantity: number;

  @IsEnum(QuantityUnit)
  unit: QuantityUnit;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsString()
  @IsOptional()
  expiryDate?: string; // ISO date string

  @IsOptional()
  isFavorite?: boolean;
}
