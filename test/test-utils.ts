import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

export async function createTestingModule(providers: any[]) {
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      ...providers,
      {
        provide: getRepositoryToken(providers[0]),
        useClass: Repository,
      },
    ],
  }).compile();

  return module;
}

export function createMockRepository() {
  return {
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    create: jest.fn(),
  };
}
