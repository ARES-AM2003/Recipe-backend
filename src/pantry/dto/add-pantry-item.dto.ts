import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { QuantityUnit } from '../entities/pantry-item.entity';

export class AddPantryItemDto {
  @ApiProperty({
    description: 'ID of the ingredient to add to pantry',
    example: 'e4a9cdd8-1843-4200-9049-f05f18a35a51',
  })
  @IsString()
  @IsNotEmpty()
  ingredientId: string;

  @ApiProperty({
    description: 'Quantity of the ingredient',
    minimum: 0.1,
    example: 2.5,
  })
  @IsNumber()
  @Min(0.1)
  quantity: number;

  @ApiProperty({
    description: 'Unit of measurement',
    enum: QuantityUnit,
    example: QuantityUnit.CUPS,
  })
  @IsEnum(QuantityUnit)
  unit: QuantityUnit;

  @IsString()
  @IsOptional()
  @ApiProperty({
    description:
      'Optional note about the pantry item (e.g., location, condition, reminder)',
    required: false,
    example: 'Stored in freezer, opened on 2024-01-15',
  })
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
