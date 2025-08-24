import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from '../../src/users/entities/user.entity';
import { UsersService } from '../../src/users/users.service';
import * as bcrypt from 'bcrypt';
import { UserRole } from '../../src/common/enums/user-role.enum';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { createMockRepository } from '../test-utils';

describe('UsersService', () => {
  let service: UsersService;
  let userRepository: any;

  const mockUser: Partial<User> = {
    id: '1',
    name: 'Test User',
    email: 'test@example.com',
    password: 'hashedPassword',
    role: UserRole.USER,
  };

  beforeEach(async () => {
    userRepository = createMockRepository();
    
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getRepositoryToken(User),
          useValue: userRepository,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return an array of users', async () => {
      userRepository.find.mockResolvedValue([mockUser]);
      const result = await service.findAll();
      expect(result).toEqual([mockUser]);
      expect(userRepository.find).toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('should return a single user', async () => {
      userRepository.findOne.mockResolvedValue(mockUser);
      const result = await service.findOne('1');
      expect(result).toEqual(mockUser);
      expect(userRepository.findOne).toHaveBeenCalledWith({ where: { id: '1' } });
    });

    it('should throw NotFoundException if user not found', async () => {
      userRepository.findOne.mockResolvedValue(null);
      await expect(service.findOne('999')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findByEmail', () => {
    it('should return a user by email', async () => {
      userRepository.findOne.mockResolvedValue(mockUser);
      const result = await service.findByEmail('test@example.com');
      expect(result).toEqual(mockUser);
      expect(userRepository.findOne).toHaveBeenCalledWith({ 
        where: { email: 'test@example.com' } 
      });
    });
  });

  describe('create', () => {
    it('should create a new user with hashed password', async () => {
      const createUserDto = {
        name: 'New User',
        email: 'new@example.com',
        password: 'password123',
      };

      const hashedPassword = 'hashedPassword123';
      const newUser = {
        ...createUserDto,
        id: '2',
        password: hashedPassword,
        role: UserRole.USER,
      };

      jest.spyOn(bcrypt, 'hash').mockResolvedValue(hashedPassword as never);
      userRepository.create.mockReturnValue(newUser);
      userRepository.save.mockResolvedValue(newUser);
      userRepository.findOne.mockResolvedValue(null);

      const result = await service.create(createUserDto);
      
      expect(bcrypt.hash).toHaveBeenCalledWith(createUserDto.password, 10);
      expect(userRepository.create).toHaveBeenCalledWith({
        ...createUserDto,
        password: hashedPassword,
        role: UserRole.USER,
      });
      expect(userRepository.save).toHaveBeenCalledWith(newUser);
      expect(result).toEqual(newUser);
    });

    it('should throw BadRequestException if email already exists', async () => {
      const createUserDto = {
        name: 'Existing User',
        email: 'existing@example.com',
        password: 'password123',
      };

      userRepository.findOne.mockResolvedValue({ email: 'existing@example.com' });

      await expect(service.create(createUserDto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('update', () => {
    it('should update user details', async () => {
      const updateUserDto = {
        name: 'Updated Name',
        email: 'updated@example.com',
      };

      const updatedUser = {
        ...mockUser,
        ...updateUserDto,
      };

      userRepository.preload.mockResolvedValue(updatedUser);
      userRepository.save.mockResolvedValue(updatedUser);

      const result = await service.update('1', updateUserDto);
      
      expect(userRepository.preload).toHaveBeenCalledWith({
        id: '1',
        ...updateUserDto,
      });
      expect(userRepository.save).toHaveBeenCalledWith(updatedUser);
      expect(result).toEqual(updatedUser);
    });

    it('should hash password if provided in update', async () => {
      const updateUserDto = {
        password: 'newPassword123',
      };

      const hashedPassword = 'hashedNewPassword123';
      const updatedUser = {
        ...mockUser,
        password: hashedPassword,
      };

      jest.spyOn(bcrypt, 'hash').mockResolvedValue(hashedPassword as never);
      userRepository.preload.mockResolvedValue(updatedUser);
      userRepository.save.mockResolvedValue(updatedUser);

      const result = await service.update('1', updateUserDto);
      
      expect(bcrypt.hash).toHaveBeenCalledWith(updateUserDto.password, 10);
      expect(result.password).toBe(hashedPassword);
    });
  });

  describe('remove', () => {
    it('should remove a user', async () => {
      userRepository.delete.mockResolvedValue({ affected: 1 });
      
      await service.remove('1');
      expect(userRepository.delete).toHaveBeenCalledWith('1');
    });

    it('should throw NotFoundException if user not found', async () => {
      userRepository.delete.mockResolvedValue({ affected: 0 });
      await expect(service.remove('999')).rejects.toThrow(NotFoundException);
    });
  });

  describe('setRefreshToken', () => {
    it('should set hashed refresh token', async () => {
      const refreshToken = 'refreshToken123';
      const hashedToken = 'hashedRefreshToken123';
      
      jest.spyOn(bcrypt, 'hash').mockResolvedValue(hashedToken as never);
      userRepository.update.mockResolvedValue({ affected: 1 });

      await service.setRefreshToken('1', refreshToken);
      
      expect(bcrypt.hash).toHaveBeenCalledWith(refreshToken, 10);
      expect(userRepository.update).toHaveBeenCalledWith('1', {
        refreshToken: hashedToken,
      });
    });
  });

  describe('getUserIfRefreshTokenMatches', () => {
    it('should return user if refresh token matches', async () => {
      const refreshToken = 'refreshToken123';
      const hashedToken = 'hashedRefreshToken123';
      const user = {
        ...mockUser,
        refreshToken: hashedToken,
      };

      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true as never);
      userRepository.findOne.mockResolvedValue(user);

      const result = await service.getUserIfRefreshTokenMatches('1', refreshToken);
      
      expect(bcrypt.compare).toHaveBeenCalledWith(refreshToken, hashedToken);
      expect(result).toEqual(user);
    });

    it('should return null if user not found', async () => {
      userRepository.findOne.mockResolvedValue(null);
      
      const result = await service.getUserIfRefreshTokenMatches('999', 'token');
      
      expect(result).toBeNull();
    });

    it('should return null if refresh token does not match', async () => {
      const user = {
        ...mockUser,
        refreshToken: 'hashedToken',
      };

      jest.spyOn(bcrypt, 'compare').mockResolvedValue(false as never);
      userRepository.findOne.mockResolvedValue(user);

      const result = await service.getUserIfRefreshTokenMatches('1', 'wrongToken');
      
      expect(result).toBeNull();
    });
  });
});
