import { NextResponse } from "next/server";

// Swap the hardcoded value with a DB query when ready.
// e.g: const { rate } = await db.query("SELECT rate FROM settings WHERE key = 'interest_rate'")

export async function GET() {
  return NextResponse.json({ rate: 0.25, label: "25% per annum" });
}
