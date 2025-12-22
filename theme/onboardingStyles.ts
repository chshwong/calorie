import { StyleSheet, Platform } from 'react-native';

export const onboardingStyles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 20,
    paddingTop: Platform.select({ web: 20, default: 50 }),
    paddingBottom: 32,
  },
  cardContainer: {
    width: '100%',
    alignSelf: 'center',
  },
  card: {
    borderRadius: 24,
    paddingVertical: 20,    // Keep top/bottom padding at 32
    paddingHorizontal: 16,   // Reduce left/right padding to 16 (half of 32)
    borderWidth: 1,
    ...Platform.select({
      web: {
        boxShadow: '0 4px 24px rgba(0, 0, 0, 0.08), 0 2px 8px rgba(0, 0, 0, 0.04)',
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 24,
        elevation: 8,
      },
    }),
  },
  cardModern: {
    borderRadius: 20,
    ...Platform.select({
      web: {
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.06)',
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.06,
        shadowRadius: 16,
        elevation: 6,
      },
    }),
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  backButton: {
    padding: 4,
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    flex: 1,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  cardContent: {
    gap: 20,
  },
  stepIndicatorTopContainer: {
    width: '100%',
    paddingVertical: 12,
    paddingHorizontal: 20,
    ...Platform.select({
      web: {
        position: 'sticky',
        top: 0,
        zIndex: 10,
        backgroundColor: 'transparent',
      },
      default: {
        backgroundColor: 'transparent',
      },
    }),
  },
  stepIndicatorWrapper: {
    width: '100%',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepIndicatorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    // paddingHorizontal is now set dynamically in the component
  },
  stepIndicatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
  },
  stepLine: {
    width: 40,
    height: 2,
    marginHorizontal: 4,
  },
  errorContainer: {
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
  },
  errorText: {
    fontSize: 14,
    textAlign: 'center',
  },
  buttonContainer: {
    marginTop: 20,
  },
  buttonContainerModern: {
    marginTop: 16,
    gap: 12,
  },
  bottomActionContainer: {
    width: '100%',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 20,
    ...Platform.select({
      web: {
        paddingHorizontal: 20,
      },
      default: {},
    }),
  },
  button: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  buttonModern: {
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legalCaption: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 16,
    fontStyle: 'italic',
    marginTop: 4,
  },
});

