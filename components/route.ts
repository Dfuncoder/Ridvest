import { NextResponse } from "next/server";

// This is where you connect to your database or config later.
// For now it returns a dummy 25% annual interest rate.
// When you're ready, replace this with a DB query like:
//   const rate = await db.query("SELECT rate FROM settings WHERE key = 'interest_rate'")

export async function GET() {
  const rate = 0.25; // 25% per annum — swap with DB value later

  return NextResponse.json(
    { rate, label: "25% per annum", updatedAt: new Date().toISOString() },
    { status: 200 }
  );
}
