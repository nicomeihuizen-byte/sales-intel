export default async function DealDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-2xl font-semibold">Deal {id}</h1>
      <p className="mt-2 text-zinc-500">
        Deal detail, notes, and AI insight coming soon. This page is part of
        the initial scaffold.
      </p>
    </div>
  );
}
