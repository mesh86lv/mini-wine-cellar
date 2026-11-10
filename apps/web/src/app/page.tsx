"use client";

import { AddBottleForm } from "@/components/add-bottle-form";
import { BottleList } from "@/components/bottle-list";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PICK_USER_PROMPT, UserSwitcher } from "@/components/user-switcher";
import { useCurrentUser } from "@/lib/current-user";

const CELLAR_CARDS = ["first", "second", "third", "fourth"] as const;

/**
 * The gate between "no user" and "a user's cellar" lives on the client, because that is where the
 * selection is: nothing here is fetched on the server, so the page owns no server data.
 */
export default function Home() {
  const { userId, ready } = useCurrentUser();

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-semibold text-2xl tracking-tight">Mini Wine Cellar</h1>
          <p className="mt-1 text-muted-foreground text-sm">
            Keep track of the bottles in your cellar and like your favourites.
          </p>
        </div>
        <UserSwitcher />
      </header>

      {!ready ? (
        // The server pass and the first client render: the stored user is not known yet, so the page
        // shows placeholders instead of flashing the "pick a user" prompt.
        <section aria-label="Your cellar" aria-busy="true">
          <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
            <Skeleton className="h-80 w-full" />
            <div className="grid gap-4 sm:grid-cols-2">
              {CELLAR_CARDS.map((card) => (
                <Skeleton key={card} className="h-64 w-full" />
              ))}
            </div>
          </div>
          <p className="sr-only">Loading your cellar…</p>
        </section>
      ) : userId === null ? (
        <section
          aria-label="Your cellar"
          className="rounded-xl border border-dashed p-10 text-center"
        >
          <h2 className="font-medium text-lg">{PICK_USER_PROMPT}</h2>
          <p className="mt-1 text-muted-foreground text-sm">
            Choose one of the demo users in the switcher above to see their bottles.
          </p>
        </section>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
          <section aria-label="Add a bottle">
            <Card>
              <CardHeader>
                <h2 className="font-medium text-base leading-none">Add a bottle</h2>
                <p className="text-muted-foreground text-sm">
                  Name, producer, vintage, region and an optional photo.
                </p>
              </CardHeader>
              <CardContent>
                {/* Rendered only here, so the form never exists without a user to add to. */}
                <AddBottleForm />
              </CardContent>
            </Card>
          </section>

          <section aria-label="My cellar">
            <h2 className="mb-4 font-medium text-base">My cellar</h2>
            <BottleList />
          </section>
        </div>
      )}
    </main>
  );
}
