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
      className="block rounded border border-zinc-200 px-4 py-3 hover:border-zinc-400"
    >
      <div className="flex items-center justify-between">
        <span className="font-medium">{deal.title}</span>
        <span className="text-xs uppercase text-zinc-500">
          {STATUS_LABEL[deal.status]}
        </span>
      </div>
      <p className="mt-1 text-sm text-zinc-500">{deal.company_name}</p>
    </Link>
  );
}
