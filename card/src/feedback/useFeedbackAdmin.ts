import { useAdminAccess } from '../admin/useAdminAccess';

interface UseFeedbackAdminResult {
  isFeedbackAdmin: boolean;
  loading: boolean;
}

export function useFeedbackAdmin(): UseFeedbackAdminResult {
  const { isAdmin, loading } = useAdminAccess();
  return { isFeedbackAdmin: isAdmin, loading };
}
