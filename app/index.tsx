/**
 * Root route ("/") - StartupGate
 *
 * Uses StartupGate component to:
 * - Show branded loading screen while boot decisions are unknown
 * - Route directly to correct destination (login/onboarding/home) without flashing
 * - Prevent "Home flash then jump to onboarding" issue
 */
import StartupGate from '@/components/StartupGate';

export default function RootIndex() {
  return <StartupGate />;
}
