import { NextResponse } from "next/server";

// Stalled-deal AI insight - not implemented yet. All calls to the AI
// provider must happen here (server-side only, via lib/ai.ts) once this
// route is built out; the API key must never reach the client.
export async function POST() {
  return NextResponse.json(
    { error: "Not implemented yet" },
    { status: 501 },
  );
}
