/**
 * Custom hook for managing tab scroll state and handlers
 * 
 * Manages scroll position tracking, scroll arrow visibility, and scroll handlers
 * for horizontal tab scrolling.
 */

import { useState, useRef, useCallback } from 'react';
import { ScrollView } from 'react-native';

interface UseTabScrollStateReturn {
  /** Ref to attach to the ScrollView */
  tabsScrollViewRef: React.RefObject<ScrollView>;
  /** Ref for tracking content width */
  tabsContentWidthRef: React.MutableRefObject<number>;
  /** Ref for tracking scroll view width */
  tabsScrollViewWidthRef: React.MutableRefObject<number>;
  /** Ref for tracking current scroll offset */
  tabsScrollOffsetRef: React.MutableRefObject<number>;
  /** Whether the user can scroll left */
  canScrollLeft: boolean;
  /** Whether the user can scroll right */
  canScrollRight: boolean;
  /** Handler for scroll events */
  handleTabsScroll: (event: any) => void;
  /** Handler for content size changes */
  handleTabsContentSizeChange: (contentWidth: number, contentHeight: number) => void;
  /** Handler to scroll left */
  handleScrollLeft: () => void;
  /** Handler to scroll right */
  handleScrollRight: () => void;
}

/**
 * Hook for managing tab scroll state
 * 
 * @returns Scroll refs, state, and handlers
 */
export function useTabScrollState(): UseTabScrollStateReturn {
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const tabsScrollViewRef = useRef<ScrollView>(null);
  const tabsContentWidthRef = useRef<number>(0);
  const tabsScrollViewWidthRef = useRef<number>(0);
  const tabsScrollOffsetRef = useRef<number>(0);

  // Handle tabs scroll to update arrow visibility
  const handleTabsScroll = useCallback((event: any) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const scrollX = contentOffset.x;
    const contentWidth = contentSize.width;
    const scrollViewWidth = layoutMeasurement.width;
    
    // Store measurements in refs for later use
    if (contentWidth > 0) tabsContentWidthRef.current = contentWidth;
    if (scrollViewWidth > 0) tabsScrollViewWidthRef.current = scrollViewWidth;
    
    // Store scroll offset for positioning calculations
    tabsScrollOffsetRef.current = scrollX;
    
    // Only update if we have valid measurements
    if (contentWidth > 0 && scrollViewWidth > 0) {
      // Check if can scroll left (not at start, with small threshold)
      setCanScrollLeft(scrollX > 5);
      
      // Check if can scroll right (not at end, with small threshold)
      setCanScrollRight(scrollX + scrollViewWidth < contentWidth - 5);
    }
  }, []);

  // Handle tabs content size change to check initial scroll state
  const handleTabsContentSizeChange = useCallback((contentWidth: number, contentHeight: number) => {
    tabsContentWidthRef.current = contentWidth;
    // Delay to ensure layout is calculated, then check scroll state
    setTimeout(() => {
      if (tabsScrollViewRef.current && contentWidth > 0) {
        // Get scroll view width by measuring
        tabsScrollViewRef.current.measure((x, y, width, height, pageX, pageY) => {
          tabsScrollViewWidthRef.current = width;
          // Check initial scroll state
          if (contentWidth > width) {
            // Can scroll right initially
            setCanScrollRight(true);
            setCanScrollLeft(false); // Start at left
          } else {
            setCanScrollRight(false);
            setCanScrollLeft(false);
          }
        });
      }
    }, 150);
  }, []);

  // Scroll left handler
  const handleScrollLeft = useCallback(() => {
    if (tabsScrollViewRef.current) {
      tabsScrollViewRef.current.scrollTo({ x: 0, animated: true });
    }
  }, []);

  // Scroll right handler
  const handleScrollRight = useCallback(() => {
    if (tabsScrollViewRef.current) {
      // Scroll to end
      tabsScrollViewRef.current.scrollToEnd({ animated: true });
    }
  }, []);

  return {
    tabsScrollViewRef,
    tabsContentWidthRef,
    tabsScrollViewWidthRef,
    tabsScrollOffsetRef,
    canScrollLeft,
    canScrollRight,
    handleTabsScroll,
    handleTabsContentSizeChange,
    handleScrollLeft,
    handleScrollRight,
  };
}

