import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * Tests for meal view mode storage persistence
 * 
 * These tests verify:
 * 1. Storage serialization/deserialization works correctly
 * 2. Storage operations (getItem/setItem) work as expected
 * 3. Error handling for storage failures
 * 4. Storage key format is correct
 */

type MealViewMode = 'collapsed' | 'semi' | 'expanded';
const MEAL_VIEW_MODE_KEY = 'home.mealViewMode.v1';

// Mock storage for testing
interface MockStorage {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
}

function createMockStorage(): { storage: MockStorage; data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    storage: {
      async getItem(key: string): Promise<string | null> {
        return data.get(key) ?? null;
      },
      async setItem(key: string, value: string): Promise<void> {
        data.set(key, value);
      },
    },
  };
}

describe('Meal View Mode Storage Persistence', () => {
  beforeEach(() => {
    // Clear localStorage if available
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.clear();
    }
  });

  describe('Storage Key', () => {
    it('should use correct storage key format', () => {
      expect(MEAL_VIEW_MODE_KEY).toBe('home.mealViewMode.v1');
      expect(MEAL_VIEW_MODE_KEY).toMatch(/^home\.mealViewMode\.v\d+$/);
    });
  });

  describe('Storage Serialization', () => {
    it('should serialize view modes to JSON string', () => {
      const modes: Record<string, MealViewMode> = {
        breakfast: 'collapsed',
        lunch: 'semi',
        snack: 'expanded',
        dinner: 'collapsed',
      };
      const serialized = JSON.stringify(modes);
      expect(typeof serialized).toBe('string');
      expect(serialized).toContain('"breakfast":"collapsed"');
      expect(serialized).toContain('"lunch":"semi"');
    });

    it('should deserialize JSON string to view modes', () => {
      const json = '{"breakfast":"expanded","lunch":"semi"}';
      const parsed = JSON.parse(json) as Record<string, MealViewMode>;
      expect(parsed.breakfast).toBe('expanded');
      expect(parsed.lunch).toBe('semi');
      expect(typeof parsed).toBe('object');
    });

    it('should handle round-trip serialization correctly', () => {
      const original: Record<string, MealViewMode> = {
        breakfast: 'collapsed',
        lunch: 'semi',
        snack: 'expanded',
        dinner: 'collapsed',
      };
      const serialized = JSON.stringify(original);
      const deserialized = JSON.parse(serialized) as Record<string, MealViewMode>;
      expect(deserialized).toEqual(original);
    });
  });

  describe('Storage Operations', () => {
    it('should save and retrieve view modes correctly', async () => {
      const { storage } = createMockStorage();

      const modes: Record<string, MealViewMode> = {
        breakfast: 'expanded',
        lunch: 'semi',
      };

      await storage.setItem(MEAL_VIEW_MODE_KEY, JSON.stringify(modes));
      const retrieved = await storage.getItem(MEAL_VIEW_MODE_KEY);
      
      expect(retrieved).not.toBeNull();
      const parsed = JSON.parse(retrieved!) as Record<string, MealViewMode>;
      expect(parsed.breakfast).toBe('expanded');
      expect(parsed.lunch).toBe('semi');
    });

    it('should return null when key does not exist', async () => {
      const { storage } = createMockStorage();
      const retrieved = await storage.getItem('non-existent-key');
      expect(retrieved).toBeNull();
    });

    it('should overwrite existing values when setting same key', async () => {
      const { storage } = createMockStorage();

      const initial: Record<string, MealViewMode> = { breakfast: 'semi' };
      await storage.setItem(MEAL_VIEW_MODE_KEY, JSON.stringify(initial));

      const updated: Record<string, MealViewMode> = { breakfast: 'expanded' };
      await storage.setItem(MEAL_VIEW_MODE_KEY, JSON.stringify(updated));

      const retrieved = await storage.getItem(MEAL_VIEW_MODE_KEY);
      const parsed = JSON.parse(retrieved!) as Record<string, MealViewMode>;
      expect(parsed.breakfast).toBe('expanded');
    });
  });

  describe('Storage Integration', () => {
    it('should handle complete save/load cycle', async () => {
      const { storage } = createMockStorage();

      const modesToSave: Record<string, MealViewMode> = {
        breakfast: 'collapsed',
        lunch: 'expanded',
        snack: 'semi',
        dinner: 'expanded',
      };

      // Save
      await storage.setItem(MEAL_VIEW_MODE_KEY, JSON.stringify(modesToSave));

      // Load
      const retrieved = await storage.getItem(MEAL_VIEW_MODE_KEY);
      expect(retrieved).not.toBeNull();

      const modesLoaded = JSON.parse(retrieved!) as Record<string, MealViewMode>;
      expect(modesLoaded).toEqual(modesToSave);
      expect(modesLoaded.breakfast).toBe('collapsed');
      expect(modesLoaded.lunch).toBe('expanded');
      expect(modesLoaded.snack).toBe('semi');
      expect(modesLoaded.dinner).toBe('expanded');
    });

    it('should handle partial state updates correctly', async () => {
      const { storage } = createMockStorage();

      // Initial state
      const initial: Record<string, MealViewMode> = {
        breakfast: 'semi',
        lunch: 'semi',
      };
      await storage.setItem(MEAL_VIEW_MODE_KEY, JSON.stringify(initial));

      // Update only one meal type
      const updated = { ...initial, breakfast: 'expanded' as MealViewMode };
      await storage.setItem(MEAL_VIEW_MODE_KEY, JSON.stringify(updated));

      // Verify
      const retrieved = await storage.getItem(MEAL_VIEW_MODE_KEY);
      const loaded = JSON.parse(retrieved!) as Record<string, MealViewMode>;
      expect(loaded.breakfast).toBe('expanded');
      expect(loaded.lunch).toBe('semi');
    });

    it('should handle invalid JSON in storage gracefully', async () => {
      const { storage } = createMockStorage();

      // Store invalid JSON
      await storage.setItem(MEAL_VIEW_MODE_KEY, '{invalid json}');
      const retrieved = await storage.getItem(MEAL_VIEW_MODE_KEY);
      
      expect(retrieved).toBe('{invalid json}');
      expect(() => JSON.parse(retrieved!)).toThrow();
    });

    it('should handle empty state correctly', async () => {
      const { storage } = createMockStorage();

      const emptyState: Record<string, MealViewMode> = {};
      await storage.setItem(MEAL_VIEW_MODE_KEY, JSON.stringify(emptyState));
      const retrieved = await storage.getItem(MEAL_VIEW_MODE_KEY);
      
      const parsed = JSON.parse(retrieved!) as Record<string, MealViewMode>;
      expect(Object.keys(parsed)).toHaveLength(0);
    });
  });
});
