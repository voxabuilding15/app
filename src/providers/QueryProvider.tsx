import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type PropsWithChildren } from 'react';

/**
 * All data is local, so results never go stale on their own: queries are invalidated explicitly
 * after writes, and there is nothing to retry or refetch over a network.
 */
export function QueryProvider({ children }: PropsWithChildren) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: Infinity,
            gcTime: 5 * 60_000,
            networkMode: 'always',
            retry: false,
            refetchOnWindowFocus: false,
          },
          mutations: { networkMode: 'always' },
        },
      }),
  );

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
