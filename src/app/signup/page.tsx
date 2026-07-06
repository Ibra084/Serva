"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AuthShell, AuthDivider } from "@/components/auth/auth-shell";
import { createClient } from "@/lib/supabase/client";
import { enableDemoSession } from "@/lib/demo-session";

export default function SignupPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkEmail, setCheckEmail] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    const formData = new FormData(event.currentTarget);
    const supabase = createClient();

    const { data, error: signUpError } = await supabase.auth.signUp({
      email: String(formData.get("email")),
      password: String(formData.get("password")),
      options: {
        data: { full_name: String(formData.get("fullName")) },
      },
    });

    if (signUpError) {
      setError(signUpError.message);
      setSubmitting(false);
      return;
    }

    if (!data.session) {
      setCheckEmail(true);
      setSubmitting(false);
      return;
    }

    router.push("/portal");
    router.refresh();
  }

  if (checkEmail) {
    return (
      <AuthShell
        title="Check your email"
        subtitle="We've sent you a link to confirm your account."
        footer={
          <>
            Already confirmed?{" "}
            <Link href="/login" className="font-medium text-primary hover:underline">
              Log in
            </Link>
          </>
        }
      >
        <span className="mx-auto flex size-11 items-center justify-center rounded-full bg-accent text-primary">
          <MailCheck className="size-5" />
        </span>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Create your Serva account"
      subtitle="Set up your restaurant dashboard in minutes."
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-primary hover:underline">
            Log in
          </Link>
        </>
      }
    >
      <Button
        type="button"
        size="lg"
        className="h-10 w-full rounded-full text-sm"
        onClick={() => {
          enableDemoSession();
          router.push("/portal");
        }}
      >
        Continue with demo account
      </Button>

      <AuthDivider />

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <Input
          name="fullName"
          type="text"
          placeholder="Enter your full name..."
          autoComplete="name"
          required
          className="h-10 rounded-full px-4 text-sm"
        />
        <Input
          name="email"
          type="email"
          placeholder="Enter your email..."
          autoComplete="email"
          required
          className="h-10 rounded-full px-4 text-sm"
        />
        <Input
          name="password"
          type="password"
          placeholder="Create a password..."
          autoComplete="new-password"
          required
          minLength={6}
          className="h-10 rounded-full px-4 text-sm"
        />

        {error && (
          <p className="text-left text-xs text-destructive" role="alert">
            {error}
          </p>
        )}

        <Button
          type="submit"
          variant="secondary"
          size="lg"
          disabled={submitting}
          className="h-10 w-full rounded-full text-sm"
        >
          {submitting ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Signing up...
            </>
          ) : (
            "Sign up"
          )}
        </Button>
      </form>
    </AuthShell>
  );
}
