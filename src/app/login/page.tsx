"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AuthShell, AuthDivider } from "@/components/auth/auth-shell";
import { createClient } from "@/lib/supabase/client";
import { createDemoWorkspace, getUserWorkspaces, loginAsDemoUser } from "@/lib/workspace-store";

async function redirectAfterAuth(router: ReturnType<typeof useRouter>) {
  const workspaces = await getUserWorkspaces();
  if (workspaces.length === 1) {
    router.push(`/portal/${workspaces[0].workspace.slug}/dashboard`);
  } else if (workspaces.length > 1) {
    router.push("/workspace-select");
  } else {
    router.push("/onboarding/create-restaurant");
  }
}

export default function LoginPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    const formData = new FormData(event.currentTarget);
    const supabase = createClient();

    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email: String(formData.get("email")),
      password: String(formData.get("password")),
    });

    if (signInError) {
      setError(signInError.message);
      setSubmitting(false);
      return;
    }

    await redirectAfterAuth(router);
    router.refresh();
  }

  async function handleDemo() {
    setDemoLoading(true);
    try {
      await loginAsDemoUser();
      const workspace = await createDemoWorkspace();
      router.push(`/portal/${workspace.slug}/dashboard`);
      router.refresh();
    } finally {
      setDemoLoading(false);
    }
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
        disabled={demoLoading}
        className="h-10 w-full rounded-full text-sm"
        onClick={handleDemo}
      >
        {demoLoading ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            Starting demo...
          </>
        ) : (
          "Continue with demo account"
        )}
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
