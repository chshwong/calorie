import { StyleSheet, Platform } from 'react-native';
import { Spacing, BorderRadius, FontSize, FontWeight, Shadows, FontFamilies } from '@/constants/theme';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  dropdownBackdrop: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 999,
    backgroundColor: 'transparent',
  },
  scrollContent: {
    paddingVertical: 0,
    paddingTop: 0,
    paddingBottom: 40, // Increased to allow scrolling past footer (bottom nav bar ~60-80px + extra space)
    // DesktopPageContainer handles horizontal padding and max-width
  },
  headerContainer: {
    marginBottom: 0,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  backArrowButton: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    minWidth: 48,
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backArrow: {
    fontSize: 28,
    fontWeight: '400',
    lineHeight: 32,
  },
  titleCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mainTitle: {
    fontSize: 18,
    fontWeight: '600',
    lineHeight: 24,
  },
  headerRight: {
    minWidth: 48,
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  subHeaderMealType: {
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 20,
  },
  subHeaderSeparator: {
    fontSize: 13,
    opacity: 0.5,
    lineHeight: 20,
    marginHorizontal: 6,
  },
  subHeaderDate: {
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 20,
  },
  placeholder: {
    width: 48,
    height: 48,
  },
  mealTypeDropdown: {
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 4,
    ...Shadows.lg,
    overflow: 'hidden',
    minWidth: 140,
  },
  mealTypeDropdownItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  mealTypeDropdownText: {
    fontSize: 16,
  },
  foodLogContainer: {
    marginHorizontal: -12,
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 12,
    marginTop: 12,
    marginBottom: 0,
  },
  entriesSection: {
    marginTop: 0,
  },
  entriesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: Spacing.sm, // 8px padding to prevent title from touching edges
  },
  entriesHeaderLeft: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    flexShrink: 1,
    minWidth: 0,
  },
  entriesHeaderCenter: {
    flex: 1,
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingHorizontal: Spacing.sm,
  },
  entriesHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
    gap: Spacing.sm,
  },
  foodLogTitle: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    fontFamily: FontFamilies.semibold,
    lineHeight: FontSize.base * 1.2,
  },
  foodLogItemCount: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.regular,
    fontFamily: FontFamilies.regular,
    lineHeight: FontSize.sm * 1.2,
    marginTop: Spacing.xxs, // 2px - using theme token instead of hardcoded value
  },
  foodLogCalories: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    fontFamily: FontFamilies.semibold,
    lineHeight: FontSize.md * 1.2,
  },
  foodLogDivider: {
    height: 1,
    width: '100%',
    marginBottom: 12,
    opacity: 0.5,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    fontFamily: FontFamilies.bold,
  },
  detailsToggleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs, // Tightly grouped: 4px gap
  },
  detailsToggleStack: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
    margin: 0,
  },
  detailsToggleLabel: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    fontFamily: FontFamilies.medium,
  },
  detailsToggleLabelSmall: {
    fontSize: FontSize.sm,
    lineHeight: 12,
    fontWeight: '600',
    marginBottom: 2,
  },
  toggleHitSlopWrapper: {
    padding: 0,
    margin: 0,
  },
  toggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  toggleLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  toggleTrack: {
    width: 44,
    height: 24,
    borderRadius: 12,
    padding: 2,
    justifyContent: 'center',
    ...Platform.select({
      web: {
        cursor: 'pointer',
      },
    }),
  },
  toggleThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    ...Platform.select({
      web: {
        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
      },
      default: {
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 2,
      },
    }),
  },
  toggleTrackSmall: {
    width: 34,
    height: 18,
    borderRadius: 999,
    padding: 2,
    justifyContent: 'center',
    ...Platform.select({
      web: {
        cursor: 'pointer',
      },
    }),
  },
  toggleThumbSmall: {
    width: 14,
    height: 14,
    borderRadius: 999,
    ...Platform.select({
      web: {
        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
      },
      default: {
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 2,
      },
    }),
  },
  emptyState: {
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    ...Platform.select({
      web: {
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
      },
      default: {
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 3,
        elevation: 1,
      },
    }),
  },
  emptyStateText: {
    fontSize: 14,
    opacity: 0.7,
  },
  entryCard: {
    paddingVertical: Platform.select({ web: 4, default: 6 }),
    paddingHorizontal: 0,
    marginBottom: 0,
    width: '100%',
  },
  entryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 0,
    paddingHorizontal: 0,
    width: '100%',
  },
  entryHeaderLeft: {
    flex: 1,
    marginRight: 4,
  },
  entryHeaderRight: {
    marginLeft: 4,
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    zIndex: 10,
    paddingRight: 8, // Match left side padding (entryItemNameButton has paddingHorizontal: 8)
  },
  entryNameRow: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    alignItems: 'center',
    gap: 4,
    flex: 1,
    minWidth: 0,
  },
  entryItemName: {
    fontSize: 14,
    fontWeight: '600',
    flexShrink: 1,
    flex: 1,
    minWidth: 0,
  },
  entryItemNameButton: {
    paddingVertical: 10,
    paddingHorizontal: 8,
    justifyContent: 'center',
    alignItems: 'flex-start',
    borderRadius: 4,
    ...Platform.select({
      web: {
        cursor: 'pointer',
        transition: 'background-color 0.15s ease, outline 0.15s ease',
      },
    }),
  },
  entrySummary: {
    fontSize: 12,
    opacity: 1.0,
    flexShrink: 0,
  },
  entryCaloriesValue: {
    fontSize: 14,
    fontWeight: '600',
    flexShrink: 0,
  },
  entryMacrosContainer: {
    marginLeft: 8,
    marginTop: 4,
  },
  entryMacrosRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 4,
  },
  entryMacrosRowSecondary: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 4,
    marginTop: 2,
  },
  entryMacroChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  entryMacroChipLabel: {
    fontSize: 10,
    fontWeight: '500',
  },
  entryMacroChipValue: {
    fontSize: 11,
    fontWeight: '500',
  },
  mealTotalsContainer: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    marginVertical: 4,
    marginBottom: 12,
  },
  totalsBand: {
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  totalsLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  mealTotalsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  mealTotalsValue: {
    fontSize: 13,
    fontWeight: '600',
    marginRight: 2,
  },
  mealTotalsLabel: {
    fontSize: 11,
    marginRight: 4,
  },
  mealTotalsChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  mealTotalsChipLabel: {
    fontSize: 10,
    fontWeight: '500',
  },
  mealTotalsChipValue: {
    fontSize: 11,
    fontWeight: '600',
  },
  editButton: {
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 8,
    minWidth: 0,
    minHeight: 0,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 11,
    ...Platform.select({
      web: {
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.06)',
        transition: 'all 0.2s ease',
      },
      default: {
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 3,
        elevation: 1,
      },
    }),
  },
  editButtonText: {
    fontSize: 16,
  },
  deleteButton: {
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 8,
    minWidth: 0,
    minHeight: 0,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 11,
    ...Platform.select({
      web: {
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.06)',
        transition: 'all 0.2s ease',
      },
      default: {
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 3,
        elevation: 1,
      },
    }),
  },
  deleteButtonText: {
    fontSize: 16,
  },
  searchBarWrapper: {
    flex: 1,
    marginRight: 8,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
    position: 'relative',
    zIndex: 1000,
  },
  searchInputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    minHeight: 44,
  },
  searchIconLeft: {
    marginRight: 8,
  },
  searchResultsOverlay: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    marginTop: 4,
    borderWidth: 1.5,
    borderRadius: 12,
    maxHeight: 300,
    overflow: 'hidden',
    zIndex: 9999,
    ...Platform.select({
      web: {
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.25)',
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.25,
        shadowRadius: 16,
        elevation: 12,
      },
    }),
  },
  searchInput: {
    flex: 1,
    paddingVertical: 8,
    fontSize: 16,
  },
  searchLoader: {
    marginLeft: 8,
    right: 12,
    top: 12,
  },
  barcodeButton: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
    ...Platform.select({
      web: {
        cursor: 'pointer',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
        transition: 'all 0.2s ease',
        zIndex: 100,
      },
      default: {
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 3,
        elevation: 10,
      },
    }),
  },
  scannerContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  scannerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingBottom: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
  },
  scannerCloseButton: {
    padding: 8,
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scannerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  scannerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  scannerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  scannerText: {
    fontSize: 16,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  tabsContainerWrapper: {
    position: 'relative',
    overflow: 'visible',
    marginBottom: Spacing.xs, // Minimal spacing - tightened from 12
  },
  tabsScrollView: {
    borderBottomWidth: 0,
  },
  tabsContainer: {
    flexDirection: 'row',
    borderBottomWidth: 0,
    paddingRight: 40,
  },
  tabsScrollArrow: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 32,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    borderRadius: 4,
    ...Platform.select({
      web: {
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
        transition: 'background-color 0.2s ease',
      },
      default: {
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 4,
      },
    }),
  },
  tabsScrollArrowLeft: {
    left: 0,
    paddingLeft: 4,
  },
  tabsScrollArrowRight: {
    right: 0,
    paddingRight: 4,
  },
  tabsScrollArrowText: {
    fontSize: 28,
    fontWeight: '300',
    lineHeight: 32,
  },
  tabContent: {
    minHeight: 200,
  },
  emptyTabState: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTabText: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
  },
  emptyTabSubtext: {
    fontSize: 12,
    textAlign: 'center',
    opacity: 0.5,
    marginTop: 4,
  },
  searchResultsContainer: {
    borderRadius: 12,
    maxHeight: 300,
    marginBottom: 8,
    ...Platform.select({
      web: {
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.1)',
      },
      default: {
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 4,
      },
    }),
  },
  searchResultsList: {
    maxHeight: 300,
  },
  searchResultItem: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 40,
  },
  searchResultContent: {
    gap: 4,
  },
  searchResultName: {
    fontSize: 14,
    fontWeight: '600',
  },
  searchResultBrand: {
    fontSize: 13,
    opacity: 0.7,
  },
  searchResultNutrition: {
    fontSize: 12,
    opacity: 0.7,
    marginTop: 2,
  },
  justAddedBadge: {
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
    borderWidth: 1,
    marginLeft: 4,
  },
  justAddedText: {
    fontSize: 9,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  sourceBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 0,
    marginLeft: 6,
    alignSelf: 'flex-start',
  },
  sourceBadgeText: {
    fontSize: 11,
    lineHeight: 13,
    fontWeight: '500',
    textTransform: 'uppercase',
  },
  selectAllRow: {
    borderBottomWidth: 1,
    paddingVertical: 0,
  },
  selectAllText: {
    fontSize: 16,
    fontWeight: '600',
  },
  massDeleteButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  massDeleteButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  threeDotMenuButton: {
    padding: Spacing.xs,
    marginLeft: Spacing.sm,
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  threeDotMenuOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  threeDotMenuContent: {
    minWidth: 200,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    paddingVertical: Spacing.xs,
    ...Platform.select({
      web: {
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
      },
      default: {
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 5,
      },
    }),
  },
  threeDotMenuHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.xs,
    paddingBottom: Spacing.xs,
  },
  threeDotMenuCloseButton: {
    padding: Spacing.xs,
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  threeDotMenuItem: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    minHeight: 44,
    justifyContent: 'center',
  },
  threeDotMenuItemText: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.medium,
  },
  noteRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: Platform.select({ web: 0, default: 0 }),
    paddingHorizontal: 0,
    marginTop: -8,
    marginBottom: 4,
  },
  noteRowText: {
    flex: 1,
    fontSize: Platform.select({ web: 12, default: 13 }),
    fontWeight: '400',
  },
});

