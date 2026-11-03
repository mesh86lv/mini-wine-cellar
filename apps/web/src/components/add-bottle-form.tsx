"use client";

import type { Reference } from "@apollo/client";
import { CombinedGraphQLErrors } from "@apollo/client/errors";
import { useMutation } from "@apollo/client/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { AddBottleDocument, BottleFieldsFragmentDoc } from "@/gql/graphql";
import {
  BOTTLE_FORM_DEFAULT_VALUES,
  type BottleFormValues,
  bottleFormSchema,
  toAddBottleInput,
} from "@/lib/schemas/bottle";

/** Stable ids, so a double submit never stacks two identical toasts. */
const ADD_BOTTLE_SUCCESS_TOAST_ID = "bottle-added";
const ADD_BOTTLE_ERROR_TOAST_ID = "bottle-add-error";

/**
 * A rejected input arrives as a GraphQL error carrying the message the API wrote, a dead API as
 * a network error carrying its own; both go into the one toast.
 */
function toastMessage(error: unknown): string {
  if (CombinedGraphQLErrors.is(error)) {
    const first = error.errors[0];

    if (first) {
      return first.message;
    }
  }

  return error instanceof Error ? error.message : "Could not add the bottle. Please try again.";
}

/**
 * The created bottle is prepended to `myBottles` from the mutation result alone — no
 * `refetchQueries`, so the list neither flickers nor issues a second request.
 */
export function AddBottleForm() {
  const form = useForm<BottleFormValues>({
    resolver: zodResolver(bottleFormSchema),
    mode: "onTouched",
    defaultValues: BOTTLE_FORM_DEFAULT_VALUES,
  });

  const [addBottle] = useMutation(AddBottleDocument, {
    update(cache, { data }) {
      const bottle = data?.addBottle;

      if (!bottle) {
        return;
      }

      const id = cache.identify(bottle);

      if (!id) {
        return;
      }

      // The record first, then its reference in the list: `writeFragment` normalises the fields,
      // `modify` only decides where the new entry sits.
      const reference = cache.writeFragment({
        fragment: BottleFieldsFragmentDoc,
        id,
        data: bottle,
      });

      if (!reference) {
        return;
      }

      cache.modify({
        fields: {
          /** Newest first — the order the server's `(owner_id, created_at DESC)` index returns. */
          myBottles(existing: readonly Reference[] = []) {
            return [reference, ...existing];
          },
        },
      });
    },
  });

  async function onSubmit(values: BottleFormValues): Promise<void> {
    try {
      await addBottle({ variables: { input: toAddBottleInput(values) } });
    } catch (error) {
      // The values stay exactly as typed, so the user can fix one field and retry.
      toast.error(toastMessage(error), { id: ADD_BOTTLE_ERROR_TOAST_ID });
      return;
    }

    form.reset();
    toast.success("Bottle added to your cellar", { id: ADD_BOTTLE_SUCCESS_TOAST_ID });
  }

  const isSubmitting = form.formState.isSubmitting;

  return (
    <Form {...form}>
      <form
        noValidate
        className="space-y-4"
        onSubmit={(event) => {
          void form.handleSubmit(onSubmit)(event);
        }}
      >
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input
                  className="min-h-11"
                  placeholder="Barolo Riserva"
                  autoComplete="off"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="producer"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Producer</FormLabel>
              <FormControl>
                <Input
                  className="min-h-11"
                  placeholder="Giacomo Conterno"
                  autoComplete="off"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="vintage"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Vintage</FormLabel>
              <FormControl>
                {/* A string in the form, a number in the input of the mutation. */}
                <Input
                  className="min-h-11"
                  inputMode="numeric"
                  placeholder="2019"
                  autoComplete="off"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="region"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Region</FormLabel>
              <FormControl>
                <Input className="min-h-11" placeholder="Piedmont" autoComplete="off" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="photoUrl"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Photo URL</FormLabel>
              <FormControl>
                <Input
                  className="min-h-11"
                  type="url"
                  placeholder="https://example.com/bottle.png"
                  autoComplete="off"
                  {...field}
                />
              </FormControl>
              <FormDescription>Optional. A link to a photo of the label.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Disabled only while submitting: validation errors appear on submit, not on a dead button. */}
        <Button type="submit" className="min-h-11 w-full" disabled={isSubmitting}>
          {isSubmitting ? "Adding…" : "Add bottle"}
        </Button>
      </form>
    </Form>
  );
}
