import { NextResponse } from "next/server";

// Notes CRUD - not implemented yet. This route exists to hold the shape of
// the API surface described in the build plan; it's wired up in a later
// phase once the Supabase schema and auth are in place.
export async function GET() {
  return NextResponse.json(
    { error: "Not implemented yet" },
    { status: 501 },
  );
}
