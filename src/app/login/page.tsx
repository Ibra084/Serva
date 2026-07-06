"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AuthShell, AuthDivider } from "@/components/auth/auth-shell";
import { createClient } from "@/lib/supabase/client";
import { enableDemoSession } from "@/lib/demo-session";

export default function LoginPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    const formData = new FormData(event.currentTarget);
    const supabase = createClient();

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: String(formData.get("email")),
      password: String(formData.get("password")),
    });

    if (signInError) {
      setError(signInError.message);
      setSubmitting(false);
      return;
    }

    router.push("/portal");
    router.refresh();
  }

  return (
    <AuthShell
      title="Welcome back to Serva"
      subtitle="Log in to your restaurant dashboard."
      footer={
        <>
          Don&rsquo;t have an account?{" "}
          <Link href="/signup" className="font-medium text-primary hover:underline">
            Sign up
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
          placeholder="Enter your password..."
          autoComplete="current-password"
          required
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
              Logging in...
            </>
          ) : (
            "Log in"
          )}
        </Button>
      </form>
    </AuthShell>
  );
}
