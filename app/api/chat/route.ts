// app/api/chat/route.ts
import { NextResponse } from 'next/server';

export function GET() {
  return NextResponse.json({ message: "Placeholder" });
}
