import { useAuth } from "@/contexts/AuthContext";
import { useUserConfig } from "@/features/foodDiaryHome/hooks/useUserConfig";

export function useProfileBasics() {
  const { user, onboardingComplete, loading } = useAuth();
  const { data: userConfig, isLoading: userConfigLoading } = useUserConfig();

  return {
    user,
    onboardingComplete,
    loading,
    userConfig,
    isLoading: userConfigLoading,
  };
}
