import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Unique,
  Index,
  Check,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Recipe } from './recipe.entity';

@Entity('ratings')
@Unique('UQ_ratings_user_recipe', ['userId', 'recipeId'])
@Check('CHK_ratings_value_range', '"value" >= 1 AND "value" <= 5')
export class Rating {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Index('IDX_ratings_userId')
  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => Recipe, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'recipeId' })
  recipe: Recipe;

  @Index('IDX_ratings_recipeId')
  @Column({ type: 'uuid' })
  recipeId: string;

  // Rating value: 1..5 (validated via DB CHECK constraint)
  @Column({ type: 'int' })
  value: number;

  // Optional user comment on the recipe
  @Column({ type: 'text', nullable: true })
  comment?: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  constructor(partial?: Partial<Rating>) {
    Object.assign(this, partial);
  }
}
