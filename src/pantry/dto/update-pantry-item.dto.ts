import { PartialType } from '@nestjs/mapped-types';
import { AddPantryItemDto } from './add-pantry-item.dto';
import { IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { QuantityUnit } from '../entities/pantry-item.entity';

export class UpdatePantryItemDto extends PartialType(AddPantryItemDto) {
  @ApiProperty({
    description: 'ID of the ingredient to update',
    required: false,
    example: 'e4a9cdd8-1843-4200-9049-f05f18a35a51',
  })
  @IsString()
  @IsOptional()
  ingredientId?: string;

  @ApiProperty({
    description: 'Quantity of the ingredient',
    required: false,
    minimum: 0.1,
    example: 2.5,
  })
  @IsNumber()
  @Min(0.1)
  @IsOptional()
  quantity?: number;

  @ApiProperty({
    description: 'Unit of measurement',
    required: false,
    enum: QuantityUnit,
    example: QuantityUnit.CUPS,
  })
  @IsEnum(QuantityUnit)
  @IsOptional()
  unit?: QuantityUnit;

  @ApiProperty({
    description:
      'Optional note about the pantry item (e.g., location, condition, reminder)',
    required: false,
    example: 'Moved to freezer, use before weekend',
  })
  @IsString()
  @IsOptional()
  note?: string;

  @ApiProperty({
    description: 'Expiry date of the ingredient (ISO date string)',
    required: false,
    example: '2024-12-31T00:00:00.000Z',
  })
  @IsString()
  @IsOptional()
  expiryDate?: string; // ISO date string

  @ApiProperty({
    description: 'Whether this ingredient is marked as favorite',
    required: false,
    default: false,
  })
  @IsOptional()
  isFavorite?: boolean;
}
