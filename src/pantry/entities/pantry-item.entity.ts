import { Column, Entity, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Ingredient } from '../../ingredients/entities/ingredient.entity';

export enum QuantityUnit {
  GRAMS = 'g',
  KILOGRAMS = 'kg',
  MILLILITERS = 'ml',
  LITERS = 'l',
  TEASPOONS = 'tsp',
  TABLESPOONS = 'tbsp',
  CUPS = 'cups',
  PIECES = 'pcs',
  PINCH = 'pinch',
  DASH = 'dash',
  TO_TASTE = 'to taste',
}

@Entity('pantry_items')
export class PantryItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, (user) => user.pantryItems, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  userId: string;

  @ManyToOne(() => Ingredient, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'ingredientId' })
  ingredient: Ingredient;

  @Column()
  ingredientId: string;

  @Column('float')
  quantity: number;

  @Column({
    type: 'enum',
    enum: QuantityUnit,
    default: QuantityUnit.GRAMS,
  })
  unit: QuantityUnit;

  @Column({ type: 'timestamp', nullable: true })
  expiryDate: Date;

  @Column({ default: false })
  isFavorite: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  constructor(partial: Partial<PantryItem>) {
    Object.assign(this, partial);
  }
}
