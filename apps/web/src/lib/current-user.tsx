"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  readStoredUserId,
  setCurrentUserId,
  subscribeToCurrentUserId,
  switchCurrentUser,
} from "@/lib/apollo";

interface CurrentUserValue {
  /** `null` while nothing is selected — every user-scoped query stays skipped. */
  userId: string | null;
  /**
   * `false` until the stored id has been read in the browser. The server pass cannot know it, so the
   * `false` until the stored id has been read in the browser. The server pass cannot know it, so the
   * page renders skeletons instead of the "pick a user" prompt until this flips: the hydration guard.
   */
  ready: boolean;
  /** Selecting an id persists it, then resets the Apollo cache — in that order, never the reverse. */
  selectUser: (userId: string) => void;
}

const CurrentUserContext = createContext<CurrentUserValue | null>(null);

/**
 * Fake login. The stored id is the source of truth across reloads; the module-level slot in
 * `lib/apollo.tsx` is the source of truth for `authLink`, and this provider mirrors it into React
 * state so the query hooks can skip themselves.
 */
export function CurrentUserProvider({ children }: { children: ReactNode }) {
  const [userId, setUserId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Subscribed before the read below, so the very same write also reaches React state. The
    // unauth link in `lib/apollo.tsx` clears the slot the same way, which is why a stale id can
    // never leave this provider with a value the requests do not send.
    const unsubscribe = subscribeToCurrentUserId((nextUserId) => {
      setUserId(nextUserId);
    });

    setCurrentUserId(readStoredUserId());
    setReady(true);

    return unsubscribe;
  }, []);

  const selectUser = useCallback((nextUserId: string) => {
    switchCurrentUser(nextUserId);
  }, []);

  const value = useMemo<CurrentUserValue>(
    () => ({ userId, ready, selectUser }),
    [userId, ready, selectUser],
  );

  return <CurrentUserContext.Provider value={value}>{children}</CurrentUserContext.Provider>;
}

export function useCurrentUser(): CurrentUserValue {
  const value = useContext(CurrentUserContext);

  if (value === null) {
    throw new Error("useCurrentUser must be used inside <CurrentUserProvider>.");
  }

  return value;
}
