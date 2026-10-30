"use client";

import { useQuery } from "@tanstack/react-query";

import { unwrapAction } from "@/hooks/use-organization";
import { getMyProfile, listMySessions } from "@/lib/actions/profile";
import { queryKeys } from "@/lib/query-keys";

/** Personal data of the signed-in user. */
export function useProfile() {
  return useQuery({
    queryKey: queryKeys.profile,
    queryFn: () => unwrapAction(getMyProfile()),
  });
}

/** Active sessions of the signed-in user across devices. */
export function useMySessions() {
  return useQuery({
    queryKey: queryKeys.sessions,
    queryFn: () => unwrapAction(listMySessions()),
  });
}
