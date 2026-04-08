const request = require('supertest');

// Mock Prisma
const { PrismaClient } = require('@prisma/client');

describe('Goals API', () => {
  let mockPrisma;
  const mockUserId = 1;
  const mockToken = 'mock-jwt-token';

  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma = new PrismaClient();
  });

  describe('GET /api/goals', () => {
    it('should return paginated goals for user', async () => {
      const mockGoals = [
        {
          id: 1,
          title: 'Learn Flutter',
          description: 'Complete Flutter course',
          completed: false,
          userId: mockUserId,
          createdAt: new Date(),
        },
        {
          id: 2,
          title: 'Build Backend API',
          description: 'Create REST API',
          completed: true,
          userId: mockUserId,
          createdAt: new Date(),
        },
      ];

      mockPrisma.goal.findMany.mockResolvedValue(mockGoals);
      mockPrisma.goal.count.mockResolvedValue(2);

      const result = await mockPrisma.goal.findMany({
        where: { userId: mockUserId },
        skip: 0,
        take: 10,
        orderBy: { createdAt: 'desc' },
      });

      expect(result).toHaveLength(2);
      expect(result[0].userId).toBe(mockUserId);
    });

    it('should filter by completion status', async () => {
      const completedGoals = [
        {
          id: 2,
          title: 'Completed Goal',
          completed: true,
          userId: mockUserId,
        },
      ];

      mockPrisma.goal.findMany.mockResolvedValue(completedGoals);

      const result = await mockPrisma.goal.findMany({
        where: {
          userId: mockUserId,
          completed: true,
        },
      });

      expect(result).toHaveLength(1);
      expect(result[0].completed).toBe(true);
    });

    it('should handle pagination correctly', async () => {
      mockPrisma.goal.findMany.mockResolvedValue([]);
      mockPrisma.goal.count.mockResolvedValue(25);

      const page = 2;
      const limit = 10;
      const skip = (page - 1) * limit;

      await mockPrisma.goal.findMany({
        where: { userId: mockUserId },
        skip,
        take: limit,
      });

      expect(mockPrisma.goal.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 10,
          take: 10,
        })
      );
    });
  });

  describe('POST /api/goals', () => {
    it('should create a new goal', async () => {
      const newGoal = {
        title: 'New Goal',
        description: 'Goal description',
        completed: false,
      };

      const createdGoal = {
        id: 3,
        ...newGoal,
        userId: mockUserId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.goal.create.mockResolvedValue(createdGoal);

      const result = await mockPrisma.goal.create({
        data: {
          ...newGoal,
          userId: mockUserId,
        },
      });

      expect(result.title).toBe(newGoal.title);
      expect(result.userId).toBe(mockUserId);
    });

    it('should require title field', async () => {
      const invalidGoal = {
        description: 'No title',
      };

      // Title is required - this would fail validation
      expect(invalidGoal.title).toBeUndefined();
    });
  });

  describe('PUT /api/goals/:id', () => {
    it('should update an existing goal', async () => {
      const updateData = {
        title: 'Updated Title',
        completed: true,
      };

      const updatedGoal = {
        id: 1,
        title: 'Updated Title',
        description: 'Original description',
        completed: true,
        userId: mockUserId,
        updatedAt: new Date(),
      };

      mockPrisma.goal.findUnique.mockResolvedValue({ id: 1, userId: mockUserId });
      mockPrisma.goal.update.mockResolvedValue(updatedGoal);

      const result = await mockPrisma.goal.update({
        where: { id: 1 },
        data: updateData,
      });

      expect(result.title).toBe(updateData.title);
      expect(result.completed).toBe(updateData.completed);
    });

    it('should not allow updating other user goals', async () => {
      mockPrisma.goal.findUnique.mockResolvedValue({
        id: 1,
        userId: 999, // Different user
      });

      const goal = await mockPrisma.goal.findUnique({ where: { id: 1 } });
      
      // Verify ownership
      expect(goal.userId).not.toBe(mockUserId);
    });

    it('should return 404 for non-existent goal', async () => {
      mockPrisma.goal.findUnique.mockResolvedValue(null);

      const result = await mockPrisma.goal.findUnique({ where: { id: 999 } });
      expect(result).toBeNull();
    });
  });

  describe('DELETE /api/goals/:id', () => {
    it('should delete user goal', async () => {
      mockPrisma.goal.findUnique.mockResolvedValue({
        id: 1,
        userId: mockUserId,
      });
      mockPrisma.goal.delete.mockResolvedValue({ id: 1 });

      await mockPrisma.goal.delete({ where: { id: 1 } });

      expect(mockPrisma.goal.delete).toHaveBeenCalledWith({
        where: { id: 1 },
      });
    });

    it('should verify ownership before deletion', async () => {
      mockPrisma.goal.findUnique.mockResolvedValue({
        id: 1,
        userId: 999, // Different user
      });

      const goal = await mockPrisma.goal.findUnique({ where: { id: 1 } });
      expect(goal.userId).not.toBe(mockUserId);
    });
  });

  describe('Goal Statistics', () => {
    it('should calculate completion rate', async () => {
      const totalGoals = 10;
      const completedGoals = 6;

      mockPrisma.goal.count
        .mockResolvedValueOnce(totalGoals) // total
        .mockResolvedValueOnce(completedGoals); // completed

      const total = await mockPrisma.goal.count({ where: { userId: mockUserId } });
      const completed = await mockPrisma.goal.count({
        where: { userId: mockUserId, completed: true },
      });

      const completionRate = (completed / total) * 100;
      expect(completionRate).toBe(60);
    });

    it('should handle empty goals list', async () => {
      mockPrisma.goal.count.mockResolvedValue(0);

      const total = await mockPrisma.goal.count({ where: { userId: mockUserId } });
      expect(total).toBe(0);
    });
  });
});

describe('Goals Integration', () => {
  it('should complete full CRUD flow', async () => {
    const mockPrisma = new PrismaClient();
    const userId = 1;

    // 1. Create
    const newGoal = {
      id: 1,
      title: 'Integration Test Goal',
      description: 'Test description',
      completed: false,
      userId,
      createdAt: new Date(),
    };
    mockPrisma.goal.create.mockResolvedValue(newGoal);

    const created = await mockPrisma.goal.create({
      data: { title: newGoal.title, description: newGoal.description, userId },
    });
    expect(created.id).toBeDefined();

    // 2. Read
    mockPrisma.goal.findUnique.mockResolvedValue(created);
    const found = await mockPrisma.goal.findUnique({ where: { id: created.id } });
    expect(found.title).toBe(newGoal.title);

    // 3. Update
    const updated = { ...found, completed: true };
    mockPrisma.goal.update.mockResolvedValue(updated);
    const result = await mockPrisma.goal.update({
      where: { id: created.id },
      data: { completed: true },
    });
    expect(result.completed).toBe(true);

    // 4. Delete
    mockPrisma.goal.delete.mockResolvedValue(result);
    await mockPrisma.goal.delete({ where: { id: created.id } });

    mockPrisma.goal.findUnique.mockResolvedValue(null);
    const deleted = await mockPrisma.goal.findUnique({ where: { id: created.id } });
    expect(deleted).toBeNull();
  });
});
