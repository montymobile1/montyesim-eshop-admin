import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 180000, // 3 min
      gcTime: 180000, // 3 min
      refetchOnWindowFocus: false,
      retry: false,
    },
  },
});
