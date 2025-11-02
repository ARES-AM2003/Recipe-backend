import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, Min, Max, IsOptional, IsString, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';

export class RateRecipeDto {
  @ApiProperty({
    description: 'Rating value from 1 (worst) to 5 (best)',
    minimum: 1,
    maximum: 5,
    example: 4,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  value: number;

  @ApiPropertyOptional({
    description: 'Optional comment for the rating',
    maxLength: 1000,
    example: 'Tasted great! I added a bit more garlic.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  comment?: string;
}
