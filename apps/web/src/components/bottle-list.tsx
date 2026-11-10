"use client";

import { useQuery } from "@apollo/client/react";

import { BottleCard } from "@/components/bottle-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { MyBottlesDocument } from "@/gql/graphql";
import { useCurrentUser } from "@/lib/current-user";

const LIST_PLACEHOLDERS = ["first", "second", "third", "fourth"] as const;

function BottleCardSkeleton() {
  return (
    <Card aria-hidden="true" className="gap-3 py-4">
      <CardContent className="space-y-3 px-4">
        <Skeleton className="aspect-[4/3] w-full" />
        <Skeleton className="h-5 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-4 w-1/3" />
      </CardContent>
    </Card>
  );
}

/**
 * The selected user's bottles, newest first — the order comes from the server's
 * `(owner_id, created_at DESC)` access path, not from a client-side sort.
 */
export function BottleList() {
  const { userId } = useCurrentUser();

  // Skipping the query without a user is what keeps one user's bottles out of another user's view
  // and, together with the cleared id, what makes the invalid-id path loop-free.
  const { data, loading, error, refetch } = useQuery(MyBottlesDocument, { skip: !userId });

  if (!userId) {
    return null;
  }

  if (loading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2" aria-busy="true">
        {LIST_PLACEHOLDERS.map((placeholder) => (
          <BottleCardSkeleton key={placeholder} />
        ))}
        <p className="sr-only">Loading your bottles…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-destructive/40 p-6 text-center" role="alert">
        <p className="font-medium">Could not load your cellar</p>
        <p className="mt-1 text-muted-foreground text-sm">{error.message}</p>
        <Button
          className="mt-4 min-h-11 px-6"
          variant="outline"
          onClick={() => {
            void refetch();
          }}
        >
          Retry
        </Button>
      </div>
    );
  }

  const bottles = data?.myBottles ?? [];

  if (bottles.length === 0) {
    return (
      <div className="rounded-xl border border-dashed p-8 text-center">
        <p className="font-medium">Your cellar is empty</p>
        <p className="mt-1 text-muted-foreground text-sm">
          Add your first bottle with the form and it will show up here.
        </p>
      </div>
    );
  }

  return (
    <ul className="grid gap-4 sm:grid-cols-2">
      {bottles.map((bottle) => (
        <li key={bottle.id}>
          <BottleCard bottle={bottle} />
        </li>
      ))}
    </ul>
  );
}
