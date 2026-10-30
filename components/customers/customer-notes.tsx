"use client";

import { NotesPanel } from "@/components/notes/notes-panel";
import { CUSTOMER_LIMITS } from "@/config/customers";
import { useActionMutation } from "@/hooks/use-action-mutation";
import { useCustomerNotes } from "@/hooks/use-customers";
import { addCustomerNote, deleteCustomerNote } from "@/lib/actions/customers";
import { queryKeys } from "@/lib/query-keys";

export function CustomerNotes({
  customerId,
  canWrite,
}: {
  customerId: string;
  canWrite: boolean;
}) {
  const notes = useCustomerNotes(customerId);
  const invalidate = [queryKeys.customers];
  const add = useActionMutation(
    (body: string) => addCustomerNote({ customerId, body }),
    { successMessage: "Nota añadida", invalidate },
  );
  const remove = useActionMutation(deleteCustomerNote, {
    successMessage: "Nota eliminada",
    invalidate,
  });

  return (
    <NotesPanel
      add={add}
      canWrite={canWrite}
      maxLength={CUSTOMER_LIMITS.maxNoteLength}
      notes={notes}
      remove={remove}
    />
  );
}
