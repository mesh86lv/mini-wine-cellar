"use client";

import { ApolloProvider } from "@apollo/client/react";
import { type ReactNode, useState } from "react";

import { Toaster } from "@/components/ui/sonner";
import { getApolloClient } from "@/lib/apollo";
import { CurrentUserProvider } from "@/lib/current-user";

/**
 * Client-only data layer. There is no Apollo SSR here on purpose: the page renders its skeletons
 * on the server pass and every query runs in the browser.
 *
 * The client is created lazily on the first render and then kept, because the cache has to outlive
 * re-renders and a user switch calls `resetStore()` on this exact instance.
 */
export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(getApolloClient);

  return (
    <ApolloProvider client={client}>
      <CurrentUserProvider>{children}</CurrentUserProvider>
      <Toaster position="bottom-right" />
    </ApolloProvider>
  );
}
