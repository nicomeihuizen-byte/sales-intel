import Link from "next/link";
import type { DealWithCompany } from "@/lib/deals";
import type { DealStatus } from "@/lib/types";

interface DealCardProps {
  deal: DealWithCompany;
}

const STATUS_LABEL: Record<DealStatus, string> = {
  open: "Open",
  won: "Won",
  lost: "Lost",
};

export default function DealCard({ deal }: DealCardProps) {
  return (
    <Link
      href={`/deals/${deal.id}`}
      className="block rounded border border-line px-4 py-3 transition-colors hover:border-accent-dim"
    >
      <div className="flex items-center justify-between">
        <span className="font-medium text-foreground">{deal.title}</span>
        <span className="font-mono text-xs uppercase text-muted">
          {STATUS_LABEL[deal.status]}
        </span>
      </div>
      <p className="mt-1 text-sm text-muted">{deal.company_name}</p>
    </Link>
  );
}
