import { AppStatusChip } from "@/components/ui";
import { DEFAULT_COLOR } from "@/config/colors";

export { dateTimeFormatter, formatRelative } from "@/lib/format";

export function CustomerStatusChip({
  status,
}: {
  status: { label: string; color: string } | null;
}) {
  if (!status)
    return <AppStatusChip color={DEFAULT_COLOR} label="Sin estado" />;

  return <AppStatusChip color={status.color} label={status.label} />;
}

/** Secondary line under the customer name in lists. */
export function customerSubtitle(customer: {
  type: string;
  companyName: string | null;
  jobTitle: string | null;
  email: string | null;
}) {
  if (
    customer.type === "PERSON" &&
    (customer.jobTitle || customer.companyName)
  ) {
    return [customer.jobTitle, customer.companyName]
      .filter(Boolean)
      .join(" · ");
  }

  return customer.email;
}
