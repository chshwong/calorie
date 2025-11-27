// Fallback for using MaterialIcons on Android and web.

import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { SymbolWeight, SymbolViewProps } from 'expo-symbols';
import { ComponentProps } from 'react';
import { OpaqueColorValue, type StyleProp, type TextStyle } from 'react-native';

type IconMapping = Record<SymbolViewProps['name'], ComponentProps<typeof MaterialIcons>['name'] | { type: 'community', name: ComponentProps<typeof MaterialCommunityIcons>['name'] }>;
type IconSymbolName = keyof typeof MAPPING;

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
  'info.circle.fill': 'info',
  'doc.text.fill': 'description',
  'questionmark.circle.fill': 'help',
  'trash.fill': 'delete',
  'arrow.right.square.fill': 'exit-to-app',
  'flag.checkered': 'flag',
  'chart.bar.fill': 'bar-chart',
  'checkmark': 'check',
  'checkmark.circle.fill': 'check-circle',
  'barcode.viewfinder': { type: 'community', name: 'barcode' },
  'magnifyingglass': 'search',
  'plus.circle.fill': 'add-circle',
} as IconMapping;

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
