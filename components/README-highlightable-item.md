# HighlightableItem Pattern

A reusable pattern for highlighting newly added items in lists with a fade-out animation effect.

## Components

### `useNewItemHighlight` Hook

A custom hook that manages the state and animation logic for highlighting newly added items.

**Location:** `hooks/use-new-item-highlight.ts`

**Usage:**
```tsx
import { useNewItemHighlight } from '@/hooks/use-new-item-highlight';

const { markAsNewlyAdded, isNewlyAdded, getAnimationValue, clearNewlyAdded } = useNewItemHighlight(
  items,           // Array of items in the list
  (item) => item.id, // Function to extract unique ID from item
  {
    duration: 2000,        // Animation duration in ms (default: 2000)
    animationDelay: 100,   // Delay before starting animation (default: 100)
    initialOpacity: 0.3,   // Initial highlight opacity 0-1 (default: 0.3)
  }
);
```

**Methods:**
- `markAsNewlyAdded(itemId: string)` - Call this after creating a new item
- `isNewlyAdded(itemId: string)` - Check if an item should be highlighted
- `getAnimationValue(itemId: string)` - Get the animation value for an item
- `clearNewlyAdded()` - Manually clear the highlight state

### `HighlightableItem` Component

A wrapper component that applies the highlight animation to list items.

**Location:** `components/highlightable-item.tsx`

**Usage:**
```tsx
import { HighlightableItem } from '@/components/highlightable-item';

<HighlightableItem
  isHighlighted={isNewlyAdded(item.id)}
  animationValue={getAnimationValue(item.id)}
  highlightColor="#3B82F6"  // Optional: custom color (defaults to theme tint)
  highlightOpacity={0.3}     // Optional: opacity 0-1 (default: 0.3)
  borderRadius={8}           // Optional: border radius (default: 8)
  style={{ padding: 10 }}
>
  <View>Your item content</View>
</HighlightableItem>
```

## Complete Example

```tsx
import { useNewItemHighlight } from '@/hooks/use-new-item-highlight';
import { HighlightableItem } from '@/components/highlightable-item';

function MyListScreen() {
  const [items, setItems] = useState<Item[]>([]);
  
  const { markAsNewlyAdded, isNewlyAdded, getAnimationValue } = useNewItemHighlight(
    items,
    (item) => item.id
  );

  const handleAddItem = async () => {
    const newItem = await saveItem();
    setItems([...items, newItem]);
    markAsNewlyAdded(newItem.id);
  };

  return (
    <View>
      {items.map(item => (
        <HighlightableItem
          key={item.id}
          isHighlighted={isNewlyAdded(item.id)}
          animationValue={getAnimationValue(item.id)}
        >
          <View style={styles.itemContent}>
            <Text>{item.name}</Text>
          </View>
        </HighlightableItem>
      ))}
    </View>
  );
}
```

## How It Works

1. When you create a new item, call `markAsNewlyAdded(itemId)` with the new item's ID
2. The hook watches the items array and detects when the new item appears
3. It creates an animation value and starts a fade-out animation (2 seconds by default)
4. The `HighlightableItem` component renders an overlay that fades from the highlight color to transparent
5. After the animation completes, everything is cleaned up automatically

## Customization

You can customize the animation by passing options to `useNewItemHighlight`:
- `duration`: How long the fade-out takes (default: 2000ms)
- `animationDelay`: Delay before starting animation (default: 100ms)
- `initialOpacity`: Starting opacity of the highlight (default: 0.3)

You can also customize the visual appearance via `HighlightableItem` props:
- `highlightColor`: Custom highlight color
- `highlightOpacity`: Custom opacity
- `borderRadius`: Custom border radius

