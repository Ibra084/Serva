"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { BrandHeader } from "@/components/shared/brand-header";
import { createClient } from "@/lib/supabase/client";

const posOptions = [
  "Toast",
  "Square",
  "Lightspeed",
  "Micros",
  "Foodics",
  "Other",
];

export default function DemoPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    const formData = new FormData(event.currentTarget);
    const supabase = createClient();

    const { error: insertError } = await supabase.from("demo_requests").insert({
      full_name: formData.get("fullName"),
      restaurant_name: formData.get("restaurantName"),
      email: formData.get("email"),
      phone: formData.get("phone"),
      location: formData.get("location"),
      pos_system: formData.get("pos"),
      biggest_problem: formData.get("problem"),
    });

    if (insertError) {
      setError("Something went wrong submitting your request. Please try again.");
      setSubmitting(false);
      return;
    }

    router.push("/thank-you");
  }

  return (
    <div className="hero-wash flex min-h-full flex-1 flex-col">
      <BrandHeader />

      <main className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="surface-raised w-full max-w-xl rounded-3xl px-8 py-10 sm:px-10">
          <div className="flex flex-col gap-1.5 text-center">
            <h1 className="font-serif text-2xl font-medium tracking-tight text-foreground sm:text-3xl">
              Request a demo
            </h1>
            <p className="text-sm leading-relaxed text-muted-foreground">
              See Serva running on your own menu and your own numbers.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="fullName">Full name</Label>
                <Input id="fullName" name="fullName" placeholder="Marco Rossi" required />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="restaurantName">Restaurant name</Label>
                <Input
                  id="restaurantName"
                  name="restaurantName"
                  placeholder="Marco's Kitchen"
                  required
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="you@restaurant.com"
                  autoComplete="email"
                  required
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="phone">Phone number</Label>
                <Input
                  id="phone"
                  name="phone"
                  type="tel"
                  placeholder="+971 50 123 4567"
                  autoComplete="tel"
                  required
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="location">Location</Label>
                <Input id="location" name="location" placeholder="Dubai, UAE" required />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="pos">POS system</Label>
                <Select id="pos" name="pos" defaultValue="" required>
                  <option value="" disabled>
                    Select your POS
                  </option>
                  {posOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="problem">Biggest problem</Label>
              <Textarea
                id="problem"
                name="problem"
                placeholder="What's the one thing you wish you understood better about your restaurant?"
                required
              />
            </div>

            {error && (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            )}

            <Button
              type="submit"
              size="lg"
              disabled={submitting}
              className="group mt-2 h-11 w-full rounded-lg text-[0.95rem]"
            >
              {submitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  Request a demo
                  <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" />
                </>
              )}
            </Button>
          </form>
        </div>
      </main>
    </div>
  );
}
