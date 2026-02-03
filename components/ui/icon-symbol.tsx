// Fallback for using MaterialIcons on Android and web.

import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { SymbolWeight, SymbolViewProps } from 'expo-symbols';
import { ComponentProps } from 'react';
import { OpaqueColorValue, type StyleProp, type TextStyle } from 'react-native';

type IconMappingValue = ComponentProps<typeof MaterialIcons>['name'] | { type: 'community'; name: ComponentProps<typeof MaterialCommunityIcons>['name'] };
/** Keys are SF Symbol names where possible; custom keys (e.g. 'block') allowed for Material-only icons. */
type IconMapping = Record<string, IconMappingValue>;
export type IconSymbolName = keyof typeof MAPPING;

/**
 * Add your SF Symbols to Material Icons mappings here.
 * - see Material Icons in the [Icons Directory](https://icons.expo.fyi).
 * - see SF Symbols in the [SF Symbols](https://developer.apple.com/sf-symbols/) app.
 */
const MAPPING = {
  'house.fill': 'home',
  'paperplane.fill': 'send',
  'chevron.left.forwardslash.chevron.right': 'code',
  'chevron.right': 'chevron-right',
  'chevron.left': 'chevron-left',
  'chevron.up': 'keyboard-arrow-up',
  'chevron.down': 'keyboard-arrow-down',
  'pencil': 'edit',
  'fork.knife': 'restaurant',
  'calendar': 'calendar-today',
  'desktopcomputer': 'computer',
  'xmark': 'close',
  'person.fill': 'account-circle',
  'lock.fill': 'lock',
  'envelope.fill': 'email',
  'ruler.fill': 'straighten',
  'moon.fill': 'dark-mode',
  'sun.max.fill': 'light-mode',
  'bell.fill': 'notifications',
  'arrow.down.doc.fill': 'file-download',
  'hand.raised.fill': 'privacy-tip',
  'hand.wave': { type: 'community', name: 'hand-wave' },
  'info.circle.fill': 'info',
  'doc.text.fill': 'description',
  'questionmark.circle.fill': 'help',
  'trash.fill': 'delete',
  'arrow.right.square.fill': 'exit-to-app',
  'flag.checkered': 'flag',
  'chart.bar.fill': 'bar-chart',
  'checkmark': 'check',
  'checkmark.circle': 'check-circle',
  'checkmark.circle.fill': 'check-circle',
  'xmark.circle': 'cancel',
  'block': 'block',
  'exclamationmark.triangle.fill': 'warning',
  'barcode.viewfinder': { type: 'community', name: 'barcode' },
  'magnifyingglass': 'search',
  'plus.circle.fill': 'add-circle',
  'book.fill': 'menu-book',
  'figure.run': { type: 'community', name: 'run-fast' },
  'ellipsis.circle.fill': 'more-horiz',
  'globe': 'language',
  'figure.walk': { type: 'community', name: 'walk' },
  'figure.run.circle': { type: 'community', name: 'run' },
  'dumbbell.fill': { type: 'community', name: 'dumbbell' },
  'scale.bathroom': { type: 'community', name: 'scale-bathroom' },
  'bicycle': { type: 'community', name: 'bicycle' },
  'figure.pool.swim': { type: 'community', name: 'swim' },
  'figure.yoga': { type: 'community', name: 'yoga' },
  'figure.flexibility': { type: 'community', name: 'yoga' },
  'figure.meditation': { type: 'community', name: 'yoga' },
  'figure.seated': { type: 'community', name: 'yoga' },
  'bolt.fill': 'flash-on',
  'figure.arms.open': { type: 'community', name: 'arm-flex' },
  'figure.chest': { type: 'community', name: 'weight-lifter' },
  'figure.barbell': { type: 'community', name: 'dumbbell' },
  'arrow.up.circle.fill': { type: 'community', name: 'arrow-up' },
  'arrow.down.circle.fill': { type: 'community', name: 'arrow-down' },
  'figure.strengthtraining.traditional': { type: 'community', name: 'weight-lifter' },
  'pills.fill': { type: 'community', name: 'pill' },
  'cross.case.fill': { type: 'community', name: 'medical-bag' },
  'drop.fill': { type: 'community', name: 'water' },
  'sparkles': { type: 'community', name: 'star' },
  'flame.fill': { type: 'community', name: 'fire' },
  'lightbulb.fill': 'lightbulb',
  'gearshape': 'settings',
  'gearshape.fill': 'settings',
  'cup.and.saucer.fill': { type: 'community', name: 'cup-outline' },
  'cup.water.fill': { type: 'community', name: 'cup-water' },
  'wineglass.fill': { type: 'community', name: 'glass-wine' },
  'bottle.fill': { type: 'community', name: 'bottle-wine-outline' },
  'plus': 'add',
  'doc.on.doc': 'content-copy',
  'ellipsis': 'more-horiz',
  'note.text': { type: 'community', name: 'note-text' },
  'target': 'center-focus-strong',
  'slider.horizontal.3': 'tune',
} satisfies Record<string, IconMappingValue>;

/**
 * An icon component that uses native SF Symbols on iOS, and Material Icons on Android and web.
 * This ensures a consistent look across platforms, and optimal resource usage.
 * Icon `name`s are based on SF Symbols and require manual mapping to Material Icons.
 */
export function IconSymbol({
  name,
  size = 24,
  color,
  style,
  accessibilityLabel,
  decorative = false,
}: {
  name: IconSymbolName;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<TextStyle>;
  weight?: SymbolWeight;
  accessibilityLabel?: string;
  decorative?: boolean;
}) {
  const accessibilityProps = decorative
    ? {
        accessibilityElementsHidden: true,
        importantForAccessibility: 'no-hide-descendants' as const,
      }
    : accessibilityLabel
    ? {
        accessibilityRole: 'image' as const,
        accessibilityLabel,
      }
    : {};

  const iconMapping = MAPPING[name];
  
  // Check if this icon uses MaterialCommunityIcons
  if (typeof iconMapping === 'object' && iconMapping.type === 'community') {
    return (
      <MaterialCommunityIcons
        color={color}
        size={size}
        name={iconMapping.name}
        style={style}
        {...accessibilityProps}
      />
    );
  }
  
  // Default to MaterialIcons
  return (
    <MaterialIcons
      color={color}
      size={size}
      name={iconMapping as ComponentProps<typeof MaterialIcons>['name']}
      style={style}
      {...accessibilityProps}
    />
  );
}
