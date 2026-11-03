"use client";

import { useQuery } from "@apollo/client/react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { UsersDocument } from "@/gql/graphql";
import { useCurrentUser } from "@/lib/current-user";

/** Shared with the page: the switcher's placeholder and the empty cellar both say the same thing. */
export const PICK_USER_PROMPT = "Pick a user to open their cellar";

/**
 * Fake login: the public `users` query feeds a shadcn `Select`. The control shows the prompt
 * as its placeholder while nothing is selected, so the header states the next step on its own.
 */
export function UserSwitcher() {
  const { userId, ready, selectUser } = useCurrentUser();
  const { data, loading, error } = useQuery(UsersDocument);

  // `ready` covers the client-side hydration pass: the trigger would otherwise open with no value
  // and then jump to the stored one.
  if (!ready || loading) {
    return <Skeleton aria-hidden="true" className="h-11 w-full sm:w-64" />;
  }

  if (error) {
    return (
      <p className="text-destructive text-sm" role="alert">
        Could not load the users. Reload the page to try again.
      </p>
    );
  }

  return (
    <Select value={userId ?? ""} onValueChange={selectUser}>
      {/* `min-h-11` keeps the 44px tap target without fighting the trigger's own height. */}
      <SelectTrigger aria-label="Choose a user" className="min-h-11 w-full sm:w-64">
        <SelectValue placeholder={PICK_USER_PROMPT} />
      </SelectTrigger>
      <SelectContent>
        {(data?.users ?? []).map((user) => (
          <SelectItem key={user.id} value={user.id} className="min-h-11">
            {user.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
