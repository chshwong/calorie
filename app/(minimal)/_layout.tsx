/**
 * Minimal layout group - no header/footer
 * 
 * Routes in this group render without global header/footer.
 * Used for loading screen and other minimal UI screens.
 */

import { Slot } from 'expo-router';

export default function MinimalLayout() {
  return <Slot />;
}

