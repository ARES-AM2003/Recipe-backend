import { PartialType } from '@nestjs/mapped-types';
import { AddPantryItemDto } from './add-pantry-item.dto';
import { IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { QuantityUnit } from '../entities/pantry-item.entity';

export class UpdatePantryItemDto extends PartialType(AddPantryItemDto) {
  @IsString()
  @IsOptional()
  ingredientId?: string;

  @IsNumber()
  @Min(0.1)
  @IsOptional()
  quantity?: number;

  @IsEnum(QuantityUnit)
  @IsOptional()
  unit?: QuantityUnit;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsString()
  @IsOptional()
  expiryDate?: string; // ISO date string

  @IsOptional()
  isFavorite?: boolean;
}
