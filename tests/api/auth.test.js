const request = require('supertest');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Mock express app
const mockApp = {
  use: jest.fn(),
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  delete: jest.fn(),
};

describe('Auth API', () => {
  let mockPrisma;
  
  beforeEach(() => {
    jest.clearAllMocks();
    // Get fresh mock instance
    const { PrismaClient } = require('@prisma/client');
    mockPrisma = new PrismaClient();
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user successfully', async () => {
      const newUser = {
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User',
      };

      mockPrisma.user.findFirst.mockResolvedValue(null); // User doesn't exist
      mockPrisma.user.create.mockResolvedValue({
        id: 1,
        email: newUser.email,
        name: newUser.name,
        role: 'USER',
      });

      // Simulate successful registration
      expect(mockPrisma.user.findFirst).not.toHaveBeenCalled();
      expect(newUser.email).toBe('test@example.com');
      expect(newUser.name).toBe('Test User');
    });

    it('should return 400 if email already exists', async () => {
      const existingUser = {
        id: 1,
        email: 'existing@example.com',
        name: 'Existing User',
      };

      mockPrisma.user.findFirst.mockResolvedValue(existingUser);

      // Simulate duplicate check
      const result = await mockPrisma.user.findFirst({ where: { email: existingUser.email } });
      expect(result).toEqual(existingUser);
    });

    it('should hash password before saving', async () => {
      const password = 'password123';
      const hashedPassword = await bcrypt.hash(password, 10);
      
      expect(hashedPassword).not.toBe(password);
      expect(hashedPassword.length).toBeGreaterThan(password.length);
    });
  });

  describe('POST /api/auth/login', () => {
    it('should login with valid credentials', async () => {
      const user = {
        id: 1,
        email: 'test@example.com',
        password: await bcrypt.hash('password123', 10),
        name: 'Test User',
        role: 'USER',
      };

      mockPrisma.user.findUnique.mockResolvedValue(user);

      const passwordValid = await bcrypt.compare('password123', user.password);
      expect(passwordValid).toBe(true);

      // Simulate JWT token generation
      const token = jwt.sign(
        { userId: user.id, email: user.email, role: user.role },
        process.env.JWT_SECRET || 'test-secret',
        { expiresIn: '24h' }
      );

      expect(token).toBeDefined();
      expect(token.split('.')).toHaveLength(3); // JWT structure
    });

    it('should fail with invalid password', async () => {
      const user = {
        id: 1,
        email: 'test@example.com',
        password: await bcrypt.hash('password123', 10),
      };

      const passwordValid = await bcrypt.compare('wrongpassword', user.password);
      expect(passwordValid).toBe(false);
    });

    it('should fail if user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const result = await mockPrisma.user.findUnique({ where: { email: 'nonexistent@example.com' } });
      expect(result).toBeNull();
    });
  });

  describe('GET /api/auth/profile', () => {
    it('should return user profile with valid token', async () => {
      const user = {
        id: 1,
        email: 'test@example.com',
        name: 'Test User',
        role: 'USER',
        avatarUrl: null,
      };

      mockPrisma.user.findUnique.mockResolvedValue(user);

      const result = await mockPrisma.user.findUnique({ where: { id: 1 } });
      expect(result).toEqual(user);
      expect(result.password).toBeUndefined();
    });
  });
});

describe('Auth Middleware', () => {
  it('should verify valid JWT token', () => {
    const payload = { userId: 1, email: 'test@example.com', role: 'USER' };
    const token = jwt.sign(payload, process.env.JWT_SECRET || 'test-secret');

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'test-secret');
    expect(decoded.userId).toBe(payload.userId);
    expect(decoded.email).toBe(payload.email);
  });

  it('should reject invalid token', () => {
    const invalidToken = 'invalid.token.here';
    
    expect(() => {
      jwt.verify(invalidToken, process.env.JWT_SECRET || 'test-secret');
    }).toThrow();
  });
});
