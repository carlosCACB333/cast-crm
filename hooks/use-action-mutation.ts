"use client";

import type { ActionResult } from "@/lib/actions/result";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { notify } from "@/components/ui";
import { queryKeys } from "@/lib/query-keys";

interface Options {
  successMessage?: string;
  /** Query keys to invalidate on success. Defaults to every organization query. */
  invalidate?: readonly (readonly string[])[];
}

/** Wraps a Server Action in a TanStack mutation with cache invalidation and toasts. */
export function useActionMutation<TInput, TData>(
  action: (input: TInput) => Promise<ActionResult<TData>>,
  { successMessage, invalidate = [queryKeys.organizations] }: Options = {},
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: TInput) => {
      const result = await action(input);

      if (!result.ok) throw new Error(result.error);

      return result.data;
    },
    onSuccess: async () => {
      await Promise.all(
        invalidate.map((queryKey) =>
          queryClient.invalidateQueries({ queryKey }),
        ),
      );
      if (successMessage) notify.success(successMessage);
    },
    onError: (error) => notify.error(error.message),
  });
}
