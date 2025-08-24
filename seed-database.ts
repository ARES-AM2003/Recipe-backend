import { DataSource } from 'typeorm';
import { DatabaseSeeder } from './src/database/seeders/database.seeder';
import { dataSourceOptions } from './typeorm.config';

async function runSeeder() {
  console.log('Starting database seeding...');

  const dataSource = new DataSource({
    ...dataSourceOptions,
    synchronize: false,
    migrationsRun: false,
  });

  try {
    // await dataSource.initialize();
    // console.log('Data Source has been initialized!');

    // const seeder = new DatabaseSeeder(
    //   dataSource.getRepository('User'),
    //   dataSource.getRepository('Ingredient'),
    //   dataSource.getRepository('Recipe'),
    //   dataSource.getRepository('PantryItem'),
    // );

    // await seeder.seed();
    console.log('Database seeded successfully!');
  } catch (error) {
    console.error('Error during database seeding:', error);
    process.exit(1);
  } finally {
    await dataSource.destroy();
  }
}

runSeeder();
