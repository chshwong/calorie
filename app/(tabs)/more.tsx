import { useEffect } from 'react';
import { useRouter } from 'expo-router';

// This route exists only to back the "More" tab button.
// The tab button opens an in-place menu; if this route is ever reached (deeplink),
// forward to the root modal Settings screen.
export default function MoreScreen() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/settings');
  }, [router]);

  return null;
}


