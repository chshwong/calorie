/**
 * MODULE CONFIGURATIONS
 * 
 * Central configuration for focus modules used in footer and quick add menu.
 * Maps module keys to their display labels, route names, and icons.
 */

import React from 'react';
import { IconSymbol } from '@/components/ui/icon-symbol';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { FocusModule } from '@/utils/types';

export interface ModuleConfig {
  key: FocusModule;
  label: string;
  routeName: string;
  icon: (props: { color: string; size?: number }) => React.ReactElement;
}

export const MODULE_CONFIGS: Record<FocusModule, ModuleConfig> = {
  Food: {
    key: 'Food',
    label: 'Food Diary',
    routeName: 'index',
    icon: ({ color, size = 28 }) => <IconSymbol size={size} name="book.fill" color={color} />,
  },
  Exercise: {
    key: 'Exercise',
    label: 'Exercise',
    routeName: 'exercise',
    icon: ({ color, size = 28 }) => <MaterialCommunityIcons name="heart-pulse" size={size} color={color} />,
  },
  Med: {
    key: 'Med',
    label: 'Meds',
    routeName: 'meds',
    icon: ({ color, size = 28 }) => <MaterialCommunityIcons name="pill" size={size} color={color} />,
  },
  Water: {
    key: 'Water',
    label: 'Water',
    routeName: 'water',
    icon: ({ color, size = 28 }) => <MaterialCommunityIcons name="water" size={size} color={color} />,
  },
};

/**
 * Get the module configuration for a focus module
 */
export function getModuleConfig(module: FocusModule): ModuleConfig {
  return MODULE_CONFIGS[module];
}

