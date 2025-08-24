import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../../src/users/users.service';
import { AuthService } from '../../src/auth/auth.service';
import * as bcrypt from 'bcrypt';
import { User } from '../../src/users/entities/user.entity';
import { UserRole } from '../../src/common/enums/user-role.enum';
import { UnauthorizedException } from '@nestjs/common';
import { createMockRepository } from '../test-utils';

describe('AuthService', () => {
  let service: AuthService;
  let usersService: any;
  let jwtService: any;
  let configService: any;

  const mockUser: Partial<User> = {
    id: '1',
    name: 'Test User',
    email: 'test@example.com',
    password: 'hashedPassword',
    role: UserRole.USER,
  };

  const mockTokens = {
    accessToken: 'accessToken123',
    refreshToken: 'refreshToken123',
  };

  beforeEach(async () => {
    // Mock UsersService
    usersService = {
      findByEmail: jest.fn(),
      setRefreshToken: jest.fn(),
      getUserIfRefreshTokenMatches: jest.fn(),
    };

    // Mock JwtService
    jwtService = {
      sign: jest.fn(),
      verify: jest.fn(),
    };

    // Mock ConfigService
    configService = {
      get: jest.fn((key: string) => {
        const config = {
          'JWT_ACCESS_SECRET': 'accessSecret',
          'JWT_REFRESH_SECRET': 'refreshSecret',
          'JWT_ACCESS_EXPIRES_IN': '15m',
          'JWT_REFRESH_EXPIRES_IN': '7d',
        };
        return config[key];
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UsersService,
          useValue: usersService,
        },
        {
          provide: JwtService,
          useValue: jwtService,
        },
        {
          provide: ConfigService,
          useValue: configService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('validateUser', () => {
    it('should return user if credentials are valid', async () => {
      const email = 'test@example.com';
      const password = 'password123';
      const hashedPassword = await bcrypt.hash(password, 10);
      
      const user = {
        ...mockUser,
        password: hashedPassword,
      };

      usersService.findByEmail.mockResolvedValue(user);
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true as never);

      const result = await service.validateUser(email, password);
      
      expect(usersService.findByEmail).toHaveBeenCalledWith(email);
      expect(result).toEqual({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      });
    });

    it('should return null if user not found', async () => {
      usersService.findByEmail.mockResolvedValue(null);
      
      const result = await service.validateUser('nonexistent@example.com', 'password');
      
      expect(result).toBeNull();
      expect(usersService.findByEmail).toHaveBeenCalledWith('nonexistent@example.com');
    });

    it('should return null if password is invalid', async () => {
      const user = {
        ...mockUser,
        password: 'hashedPassword',
      };

      usersService.findByEmail.mockResolvedValue(user);
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(false as never);

      const result = await service.validateUser('test@example.com', 'wrongPassword');
      
      expect(result).toBeNull();
    });
  });

  describe('login', () => {
    it('should return access and refresh tokens', async () => {
      const user = {
        id: '1',
        email: 'test@example.com',
        name: 'Test User',
        role: UserRole.USER,
      };

      jwtService.sign
        .mockReturnValueOnce(mockTokens.accessToken) // access token
        .mockReturnValueOnce(mockTokens.refreshToken); // refresh token

      usersService.setRefreshToken.mockResolvedValue(undefined);

      const result = await service.login(user);
      
      expect(jwtService.sign).toHaveBeenCalledTimes(2);
      expect(usersService.setRefreshToken).toHaveBeenCalledWith(
        user.id,
        mockTokens.refreshToken,
      );
      expect(result).toEqual({
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
        tokens: {
          accessToken: mockTokens.accessToken,
          refreshToken: mockTokens.refreshToken,
        },
      });
    });
  });

  describe('refreshToken', () => {
    it('should return new access token if refresh token is valid', async () => {
      const userId = '1';
      const refreshToken = 'validRefreshToken';
      const user = {
        ...mockUser,
        refreshToken: await bcrypt.hash(refreshToken, 10),
      };

      usersService.getUserIfRefreshTokenMatches.mockResolvedValue(user);
      jwtService.sign.mockReturnValue('newAccessToken');

      const result = await service.refreshToken(userId, refreshToken);
      
      expect(usersService.getUserIfRefreshTokenMatches).toHaveBeenCalledWith(
        userId,
        refreshToken,
      );
      expect(result).toEqual({
        accessToken: 'newAccessToken',
      });
    });

    it('should throw UnauthorizedException if refresh token is invalid', async () => {
      const userId = '1';
      const refreshToken = 'invalidRefreshToken';

      usersService.getUserIfRefreshTokenMatches.mockResolvedValue(null);

      await expect(service.refreshToken(userId, refreshToken)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('logout', () => {
    it('should clear refresh token for user', async () => {
      const userId = '1';
      
      await service.logout(userId);
      
      expect(usersService.setRefreshToken).toHaveBeenCalledWith(userId, null);
    });
  });

  describe('getTokens', () => {
    it('should return access and refresh tokens', () => {
      const userId = '1';
      const email = 'test@example.com';
      const role = UserRole.USER;

      jwtService.sign
        .mockReturnValueOnce('accessToken')
        .mockReturnValueOnce('refreshToken');

      const result = service.getTokens(userId, email, role);
      
      expect(jwtService.sign).toHaveBeenCalledWith(
        { sub: userId, email, role },
        {
          secret: 'accessSecret',
          expiresIn: '15m',
        },
      );
      
      expect(jwtService.sign).toHaveBeenCalledWith(
        { sub: userId, email, role },
        {
          secret: 'refreshSecret',
          expiresIn: '7d',
        },
      );
      
      expect(result).toEqual({
        accessToken: 'accessToken',
        refreshToken: 'refreshToken',
      });
    });
  });
});
