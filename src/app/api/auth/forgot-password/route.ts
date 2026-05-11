import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const runtime = "edge";

const ERROR_MAP: Record<string, string> = {
  "Email rate limit exceeded":
    "Too many attempts. Please wait a moment and try again.",
};

function normalizeError(message: string): string {
  return ERROR_MAP[message] ?? message;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email: string | undefined = body.email;

    if (!email?.trim()) {
      return NextResponse.json(
        { success: false, error: "Email is required." },
        { status: 400 }
      );
    }

    const siteUrl = (
      process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"
    ).replace(/\/$/, "");
    const redirectTo = `${siteUrl}/auth/reset-password`;

    console.log("[forgot-password] siteUrl:", siteUrl);
    console.log("[forgot-password] redirectTo:", redirectTo);

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { error } = await supabase.auth.resetPasswordForEmail(
      email.trim(),
      { redirectTo }
    );

    if (error) {
      console.error("[forgot-password] Supabase error:", error.message);
      return NextResponse.json(
        { success: false, error: normalizeError(error.message) },
        { status: 400 }
      );
    }

    console.log("[forgot-password] reset email sent to:", email.trim());
    return NextResponse.json({
      success: true,
      message: "Password reset email sent. Check your inbox.",
    });
  } catch (err) {
    console.error("[forgot-password] unexpected error:", err);
    return NextResponse.json(
      { success: false, error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
