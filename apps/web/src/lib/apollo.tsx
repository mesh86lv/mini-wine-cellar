"use client";

import { ApolloClient, from, HttpLink, InMemoryCache } from "@apollo/client";
import { CombinedGraphQLErrors } from "@apollo/client/errors";
import { setContext } from "@apollo/client/link/context";
import { ErrorLink } from "@apollo/client/link/error";
import { toast } from "sonner";

/**
 * The fake-login user id lives in a module-level slot on purpose.
 *
 * `authLink` runs on every request, outside of React, so an id captured during a render would be
 * whatever the last render saw: after a user switch the first request of the new user could still
 * carry the old `x-user-id`. Reading the slot at request time removes that class of bug, and the
 * user switch and the unauth link below go through `setCurrentUserId`, the only writer.
 */
let currentUserId: string | null = null;

/** Key of the id a reload has to find; the only `localStorage` entry this app writes. */
const CURRENT_USER_STORAGE_KEY = "mini-wine-cellar.current-user-id";

/** A stable toast id, so a batch of failing requests shows the message once. */
const UNAUTHENTICATED_TOAST_ID = "unauthenticated";

const currentUserListeners = new Set<(userId: string | null) => void>();

function getCurrentUserId(): string | null {
  return currentUserId;
}

/**
 * The single writer of the slot. Every subscriber (today: the current-user context) hears about the
 * change, so React state and the header `authLink` sends cannot drift apart.
 */
export function setCurrentUserId(userId: string | null): void {
  currentUserId = userId;

  for (const listener of currentUserListeners) {
    listener(userId);
  }
}

export function subscribeToCurrentUserId(listener: (userId: string | null) => void): () => void {
  currentUserListeners.add(listener);

  return () => {
    currentUserListeners.delete(listener);
  };
}

/** `localStorage` exists only in the browser: the server pass and the first client render see `null`. */
export function readStoredUserId(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage.getItem(CURRENT_USER_STORAGE_KEY);
}

function writeStoredUserId(userId: string | null): void {
  if (typeof window === "undefined") {
    return;
  }

  if (userId === null) {
    window.localStorage.removeItem(CURRENT_USER_STORAGE_KEY);
    return;
  }

  window.localStorage.setItem(CURRENT_USER_STORAGE_KEY, userId);
}

/**
 * Drops the stored id and the slot, and reports whether there was anything to drop.
 *
 * The return value is what keeps the invalid-id path to **one** cache reset and **one** toast: a
 * second failing request in the same batch finds nothing left to clear and returns early.
 */
function forgetCurrentUserId(): boolean {
  if (getCurrentUserId() === null && readStoredUserId() === null) {
    return false;
  }

  writeStoredUserId(null);
  setCurrentUserId(null);

  return true;
}

/**
 * `resetStore()` clears the cache and refetches every active query; it rejects when one of those
 * refetches fails. The user-facing answer to that failure is the query's own error state (the list
 * renders it with a Retry button), so the rejection is only reported once instead of being left as
 * an unhandled one.
 */
function resetStore(): void {
  getApolloClient()
    .resetStore()
    .catch((error: unknown) => {
      console.error(
        "Apollo cache reset did not finish: a refetch of the active queries failed.",
        error,
      );
    });
}

/**
 * The user switch, in the only order that does not leak data: persist the id a reload will read,
 * then the slot the very next request reads, and only then throw the previous user's cache away.
 * The refetch `resetStore()` triggers already carries the new header.
 */
export function switchCurrentUser(userId: string): void {
  writeStoredUserId(userId);
  setCurrentUserId(userId);

  resetStore();
}

/**
 * `setContext` hands over whatever the previous link left in the request context. This chain sets
 * no headers before `authLink`, so the value is `undefined` in practice: normalise the shapes the
 * link API allows instead of spreading an untyped value into every request.
 */
function readHeaders(headers: unknown): Record<string, string> {
  if (headers instanceof Headers) {
    return Object.fromEntries(headers);
  }

  if (headers === null || typeof headers !== "object") {
    return {};
  }

  return Object.fromEntries(
    Object.entries(headers).filter((entry) => typeof entry[1] === "string"),
  );
}

const authLink = setContext((_operation, previousContext) => {
  const userId = getCurrentUserId();
  const headers = readHeaders(previousContext.headers);

  if (userId === null) {
    return { headers };
  }

  return { headers: { ...headers, "x-user-id": userId } };
});

const apiUrl = process.env.NEXT_PUBLIC_API_URL;

if (!apiUrl) {
  throw new Error(
    "NEXT_PUBLIC_API_URL is not set. Copy apps/web/.env.example to apps/web/.env and restart next.",
  );
}

const httpLink = new HttpLink({ uri: apiUrl });

function isUnauthenticated(error: unknown): boolean {
  return (
    CombinedGraphQLErrors.is(error) &&
    error.errors.some((graphQLError) => graphQLError.extensions?.code === "UNAUTHENTICATED")
  );
}

/**
 * A saved id no longer resolves to a user: drop it, reset the cache once, tell the user once.
 *
 * This runs before the error reaches the component tree, so a stale id never turns into an error
 * wall. The refetch that `resetStore()` triggers may still go out once with no `x-user-id`, because
 * React has not applied the cleared id yet; that request ends here as well — nothing left to clear
 * — so the path is bounded at one reset and cannot loop.
 */
const errorLink = new ErrorLink(({ error }) => {
  if (!isUnauthenticated(error) || !forgetCurrentUserId()) {
    return;
  }

  toast.error("Please pick a user again", { id: UNAUTHENTICATED_TOAST_ID });
  resetStore();
});

function createApolloClient() {
  return new ApolloClient({
    // `errorLink` sits before `authLink`, so it sees the errors of every request this client makes.
    link: from([errorLink, authLink, httpLink]),
    cache: new InMemoryCache({
      typePolicies: {
        Bottle: {
          fields: {
            /**
             * Likes only grow, so the larger of the two values wins; the default overwrite
             * would let a later-arriving, lower response from an out-of-order pair move the
             * counter backwards. Every other field keeps the default normalised-cache behaviour.
             */
            likesCount: {
              merge: (existing = 0, incoming: number): number => Math.max(existing, incoming),
            },
          },
        },
      },
    }),
  });
}

let apolloClient: ReturnType<typeof createApolloClient> | undefined;

/**
 * One client per browser tab: the cache has to survive re-renders, and the user switch calls
 * `resetStore()` on this very instance.
 */
export function getApolloClient(): ReturnType<typeof createApolloClient> {
  apolloClient ??= createApolloClient();
  return apolloClient;
}
