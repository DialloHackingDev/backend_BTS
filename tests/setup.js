// Setup file for Jest tests
// Mock console methods to reduce noise during tests
global.console = {
  ...console,
  // Keep error logging for debugging
  error: jest.fn(),
  // Suppress info and warn in tests
  info: jest.fn(),
  warn: jest.fn(),
  log: jest.fn(),
};

// Set test timeout
jest.setTimeout(10000);

// Mock Prisma for unit tests
jest.mock('@prisma/client', () => {
  const mockPrisma = {
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    goal: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    library: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    $disconnect: jest.fn(),
  };
  
  return {
    PrismaClient: jest.fn(() => mockPrisma),
  };
});
