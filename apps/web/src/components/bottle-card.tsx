"use client";

import { CombinedGraphQLErrors } from "@apollo/client/errors";
import { useApolloClient, useMutation } from "@apollo/client/react";
import { HeartIcon, WineIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { BottleFieldsFragment, LikeBottleMutation } from "@/gql/graphql";
import { BottleLikesFragmentDoc, LikeBottleDocument } from "@/gql/graphql";

/** A stable id, so a batch of ten failed clicks shows the message once, not ten times. */
const LIKE_ERROR_TOAST_ID = "like-error";

const ADDED_DATE = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

function formatAddedDate(createdAt: string): string {
  return ADDED_DATE.format(new Date(createdAt));
}

/**
 * A rejected like arrives as a GraphQL error carrying the API's message or as a network
 * error with its own; both go into the one toast. The add form's copy of this is the first
 * occurrence — a third caller is what would justify extracting it.
 */
function toastMessage(error: unknown): string {
  if (CombinedGraphQLErrors.is(error)) {
    const first = error.errors[0];

    if (first) {
      return first.message;
    }
  }

  return error instanceof Error ? error.message : "Could not like the bottle. Please try again.";
}

/**
 * One bottle of the cellar. A client component because a broken photo has to fall back to the
 * placeholder, and because the like button owns the mutation: both are interactive.
 */
export function BottleCard({ bottle }: { bottle: BottleFieldsFragment }) {
  const [photoFailed, setPhotoFailed] = useState(false);
  const [pendingLikes, setPendingLikes] = useState(0);
  const photoUrl = bottle.photoUrl;

  // The client is taken **before** `useMutation` in this same component, so `optimisticLike`
  // closes over the cache this mutation writes through. Reading it from props or from the
  // mutation's second argument would leave the click path outside that cache.
  const client = useApolloClient();
  const [likeBottle] = useMutation(LikeBottleDocument);

  /**
   * The next count is read from the cache **at click time**, optimistic layers included, so
   * ten clicks in one render batch compose to +10. A `bottle.likesCount + 1` captured at render
   * would make all ten write the same number.
   *
   * `optimistic: true` is how @apollo/client 4.3.5 spells the optional second argument of
   * `readFragment` — `readFragment(options, optimistic = !!options.optimistic)` — and it is the
   * non-deprecated form of the same call.
   */
  function optimisticLike(): LikeBottleMutation {
    const cached = client.readFragment({
      id: client.cache.identify({ __typename: "Bottle", id: bottle.id }),
      fragment: BottleLikesFragmentDoc,
      optimistic: true,
    });

    return {
      __typename: "Mutation",
      likeBottle: {
        __typename: "Bottle",
        id: bottle.id,
        likesCount: (cached?.likesCount ?? 0) + 1,
      },
    };
  }

  function handleLike(): void {
    setPendingLikes((count) => count + 1);

    // The button is never disabled while pending: the next click has to be able to read the
    // optimistic layer this one leaves behind. `pendingLikes` only drives `aria-busy`.
    void likeBottle({ variables: { id: bottle.id }, optimisticResponse: optimisticLike })
      .catch((error: unknown) => {
        // Apollo rolls the optimistic layer back by itself; the single toast is the whole
        // user-facing consequence, and its stable id collapses a failed batch into that one toast.
        toast.error(toastMessage(error), { id: LIKE_ERROR_TOAST_ID });
      })
      .finally(() => {
        setPendingLikes((count) => count - 1);
      });
  }

  return (
    <Card className="gap-3 py-4">
      <CardContent className="space-y-3 px-4">
        {photoUrl !== null && photoUrl !== "" && !photoFailed ? (
          // A plain `<img>` on purpose: bottle photos point at arbitrary external hosts, so
          // `next/image` would need every one of them in `remotePatterns`. `onError` swaps in the
          // placeholder an unreachable URL would otherwise leave as a broken-image icon.
          // biome-ignore lint/performance/noImgElement: next/image cannot serve arbitrary external photo hosts.
          <img
            src={photoUrl}
            alt={`Label of ${bottle.name}`}
            loading="lazy"
            className="aspect-[4/3] w-full rounded-md object-cover"
            onError={() => {
              setPhotoFailed(true);
            }}
          />
        ) : (
          <div
            aria-hidden="true"
            className="flex aspect-[4/3] w-full items-center justify-center rounded-md bg-muted text-muted-foreground"
          >
            <WineIcon className="size-8" />
          </div>
        )}

        <div className="space-y-1">
          <h3 className="font-medium leading-snug">{bottle.name}</h3>
          <p className="text-muted-foreground text-sm">{bottle.producer}</p>
          <p className="text-muted-foreground text-sm">
            {bottle.vintage} · {bottle.region}
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t pt-2">
          {/*
            A real `<button>` whose `aria-label` is its one accessible name, with a tap target of
            at least 44px (`min-h-11`) and the visible focus ring the shadcn `Button` carries. The
            number it renders is the cached one: the normalised cache hands the optimistic value
            back to this card through the list's query.
          */}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label={`Like ${bottle.name}, ${bottle.likesCount} likes`}
            aria-busy={pendingLikes > 0}
            className="min-h-11 px-2"
            onClick={handleLike}
          >
            <HeartIcon aria-hidden="true" className="size-4" />
            <span className="font-medium text-sm tabular-nums">{bottle.likesCount}</span>
          </Button>
          <time className="text-muted-foreground text-xs" dateTime={bottle.createdAt}>
            Added {formatAddedDate(bottle.createdAt)}
          </time>
        </div>
      </CardContent>
    </Card>
  );
}
