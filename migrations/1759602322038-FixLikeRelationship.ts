import { MigrationInterface, QueryRunner } from 'typeorm';

export class FixLikeRelationship1759602322038 implements MigrationInterface {
  name = 'FixLikeRelationship1759602322038';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Drop the duplicate junction table 'recipes_liked_by_users' if it exists
    await queryRunner.query(
      `DROP TABLE IF EXISTS "recipes_liked_by_users" CASCADE`,
    );

    // Ensure the correct junction table exists with proper structure
    await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "users_liked_recipes_recipes" (
                "usersId" uuid NOT NULL,
                "recipesId" uuid NOT NULL,
                CONSTRAINT "PK_a7d4a56950ea36702234bdc5a0b" PRIMARY KEY ("usersId", "recipesId")
            )
        `);

    // Create indexes for performance
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_dbbc16afe6ef24ef9d3f53c08c" ON "users_liked_recipes_recipes" ("usersId")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_fd527dddb414f3a3353249a895" ON "users_liked_recipes_recipes" ("recipesId")`,
    );

    // Add foreign key constraints
    await queryRunner.query(`
            ALTER TABLE "users_liked_recipes_recipes"
            DROP CONSTRAINT IF EXISTS "FK_dbbc16afe6ef24ef9d3f53c08c1"
        `);
    await queryRunner.query(`
            ALTER TABLE "users_liked_recipes_recipes"
            DROP CONSTRAINT IF EXISTS "FK_fd527dddb414f3a3353249a895a"
        `);

    await queryRunner.query(`
            ALTER TABLE "users_liked_recipes_recipes"
            ADD CONSTRAINT "FK_dbbc16afe6ef24ef9d3f53c08c1"
            FOREIGN KEY ("usersId") REFERENCES "users"("id")
            ON DELETE CASCADE ON UPDATE CASCADE
        `);
    await queryRunner.query(`
            ALTER TABLE "users_liked_recipes_recipes"
            ADD CONSTRAINT "FK_fd527dddb414f3a3353249a895a"
            FOREIGN KEY ("recipesId") REFERENCES "recipes"("id")
            ON DELETE CASCADE ON UPDATE NO ACTION
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove foreign key constraints
    await queryRunner.query(
      `ALTER TABLE "users_liked_recipes_recipes" DROP CONSTRAINT IF EXISTS "FK_fd527dddb414f3a3353249a895a"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users_liked_recipes_recipes" DROP CONSTRAINT IF EXISTS "FK_dbbc16afe6ef24ef9d3f53c08c1"`,
    );

    // Remove indexes
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_fd527dddb414f3a3353249a895"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_dbbc16afe6ef24ef9d3f53c08c"`,
    );

    // Drop the junction table
    await queryRunner.query(
      `DROP TABLE IF EXISTS "users_liked_recipes_recipes"`,
    );
  }
}
