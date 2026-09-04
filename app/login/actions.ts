"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase";

export interface AuthActionState {
  error: string | null;
  message: string | null;
}

function readCredentials(formData: FormData): { email: string; password: string } | null {
  const email = formData.get("email");
  const password = formData.get("password");

  if (typeof email !== "string" || typeof password !== "string" || !email || !password) {
    return null;
  }

  return { email, password };
}

export async function signIn(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const credentials = readCredentials(formData);
  if (!credentials) {
    return { error: "Email and password are required.", message: null };
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.signInWithPassword(credentials);

  if (error) {
    return { error: error.message, message: null };
  }

  revalidatePath("/", "layout");
  redirect("/");
}

export async function signUp(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const credentials = readCredentials(formData);
  if (!credentials) {
    return { error: "Email and password are required.", message: null };
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.auth.signUp(credentials);

  if (error) {
    return { error: error.message, message: null };
  }

  // With email confirmation enabled (Supabase's default), signUp succeeds
  // but returns no session until the user clicks the confirmation link.
  if (data.session) {
    revalidatePath("/", "layout");
    redirect("/");
  }

  return {
    error: null,
    message: "Check your email to confirm your account, then log in.",
  };
}

export async function signOut() {
  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}
