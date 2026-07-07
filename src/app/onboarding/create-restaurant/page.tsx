"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { BrandHeader } from "@/components/shared/brand-header";
import {
  createDemoWorkspace,
  createRestaurantWorkspace,
  getCurrentUser,
} from "@/lib/workspace-store";
import type { MembershipRole } from "@/lib/types";

const posOptions = ["Toast", "Square", "Lightspeed", "Micros", "Foodics", "Other"];
const roleOptions: { value: MembershipRole; label: string }[] = [
  { value: "owner", label: "Owner" },
  { value: "manager", label: "Manager" },
  { value: "staff", label: "Staff" },
  { value: "consultant", label: "Consultant" },
];

export default function CreateRestaurantPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [creatingDemo, setCreatingDemo] = useState(false);

  useEffect(() => {
    (async () => {
      if (!(await getCurrentUser())) {
        router.replace("/login");
      }
    })();
  }, [router]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);

    const formData = new FormData(event.currentTarget);
    const workspace = await createRestaurantWorkspace({
      name: String(formData.get("name")),
      location: String(formData.get("location")),
      cuisine: String(formData.get("cuisine")),
      numTables: Number(formData.get("numTables")),
      numSeats: Number(formData.get("numSeats")),
      posSystem: String(formData.get("posSystem")),
      role: formData.get("role") as MembershipRole,
    });

    router.push(`/portal/${workspace.slug}/dashboard`);
    router.refresh();
  }

  async function handleUseDemoRestaurant() {
    setCreatingDemo(true);
    const workspace = await createDemoWorkspace();
    router.push(`/portal/${workspace.slug}/dashboard`);
    router.refresh();
  }

  return (
    <div className="hero-wash flex min-h-full flex-1 flex-col">
      <BrandHeader />

      <main className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="surface-raised w-full max-w-xl rounded-3xl px-8 py-10 sm:px-10">
          <div className="flex flex-col gap-1.5 text-center">
            <h1 className="font-serif text-2xl font-medium tracking-tight text-foreground sm:text-3xl">
              Set up your restaurant
            </h1>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Create a workspace for your restaurant to get started with Serva.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="flex flex-col gap-2 sm:col-span-2">
                <Label htmlFor="name">Restaurant name</Label>
                <Input id="name" name="name" placeholder="Marco's Kitchen" required />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="location">Location</Label>
                <Input id="location" name="location" placeholder="Dubai Marina" required />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="cuisine">Cuisine</Label>
                <Input id="cuisine" name="cuisine" placeholder="Italian" required />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="numTables">Number of tables</Label>
                <Input id="numTables" name="numTables" type="number" min={1} placeholder="18" required />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="numSeats">Number of seats</Label>
                <Input id="numSeats" name="numSeats" type="number" min={1} placeholder="72" required />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="posSystem">POS system</Label>
                <Select id="posSystem" name="posSystem" defaultValue="" required>
                  <option value="" disabled>
                    Select a POS system
                  </option>
                  {posOptions.map((pos) => (
                    <option key={pos} value={pos}>
                      {pos}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="role">Your role</Label>
                <Select id="role" name="role" defaultValue="owner" required>
                  {roleOptions.map((role) => (
                    <option key={role.value} value={role.value}>
                      {role.label}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            <Button
              type="submit"
              size="lg"
              disabled={submitting}
              className="h-10 w-full rounded-full text-sm"
            >
              Create restaurant
              <ArrowRight className="size-4" />
            </Button>
          </form>

          <div className="mt-6 flex items-center gap-3">
            <span className="h-px flex-1 bg-border" />
            <span className="text-xs font-medium tracking-wide text-muted-foreground">OR</span>
            <span className="h-px flex-1 bg-border" />
          </div>

          <Button
            type="button"
            variant="secondary"
            size="lg"
            disabled={creatingDemo}
            onClick={handleUseDemoRestaurant}
            className="mt-6 h-10 w-full rounded-full text-sm"
          >
            <Sparkles className="size-4" />
            Use Demo Restaurant
          </Button>
        </div>
      </main>
    </div>
  );
}
