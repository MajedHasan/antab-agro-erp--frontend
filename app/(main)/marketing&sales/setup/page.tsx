"use client";

import { motion } from "framer-motion";
import {
  ArrowRight,
  Bug,
  ChevronRight,
  FlaskConical,
  Leaf,
  Settings2,
} from "lucide-react";
import Link from "next/link";

const setupItems = [
  {
    title: "Crops",
    description:
      "Manage crops and configure the pest types associated with each crop.",
    href: "/marketing&sales/setup/crops",
    icon: Leaf,
  },
  {
    title: "Pest Types",
    description:
      "Manage pest types and connect them with the relevant solutions.",
    href: "/marketing&sales/setup/pest-types",
    icon: Bug,
  },
  {
    title: "Solutions",
    description:
      "Manage solutions and define their available doses, units, frequency and duration.",
    href: "/marketing&sales/setup/solutions",
    icon: FlaskConical,
  },
];

export default function MarketingSetupPage() {
  return (
    <div className="min-h-full space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
            <span>Marketing</span>
            <ChevronRight className="h-4 w-4" />
            <span>Setup</span>
          </div>

          <h1 className="text-2xl font-semibold tracking-tight">
            Marketing Setup
          </h1>

          <p className="mt-1 text-sm text-muted-foreground">
            Manage crops, pest types, solutions and their treatment
            configurations.
          </p>
        </div>

        <div className="flex h-10 w-10 items-center justify-center rounded-lg border bg-background shadow-sm">
          <Settings2 className="h-5 w-5 text-muted-foreground" />
        </div>
      </div>

      {/* Setup Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        {setupItems.map((item, index) => {
          const Icon = item.icon;

          return (
            <motion.div
              key={item.title}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.25,
                delay: index * 0.06,
              }}
            >
              <Link
                href={item.href}
                className="group block h-full rounded-xl border bg-card p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="flex items-start justify-between">
                  <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-muted">
                    <Icon className="h-5 w-5 text-foreground" />
                  </div>

                  <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform duration-200 group-hover:translate-x-1" />
                </div>

                <div className="mt-5">
                  <h2 className="text-base font-semibold">{item.title}</h2>

                  <p className="mt-1.5 text-sm leading-6 text-muted-foreground">
                    {item.description}
                  </p>
                </div>

                <div className="mt-5 flex items-center text-sm font-medium">
                  Manage {item.title}
                  <ArrowRight className="ml-1.5 h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
                </div>
              </Link>
            </motion.div>
          );
        })}
      </div>

      {/* Relationship Information */}
      <div className="rounded-xl border bg-card p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
            <Settings2 className="h-4 w-4" />
          </div>

          <div>
            <h2 className="text-sm font-semibold">
              How Marketing Setup Works
            </h2>

            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              Configure the relationship between your crops, pest types,
              solutions and treatment doses. A pest type can be associated
              with multiple crops, and a solution can be used for multiple
              pest types.
            </p>
          </div>
        </div>

        <div className="mt-5 overflow-x-auto">
          <div className="flex min-w-[680px] items-center gap-3">
            <RelationshipItem
              icon={<Leaf className="h-4 w-4" />}
              title="Crop"
            />

            <RelationshipArrow />

            <RelationshipItem
              icon={<Bug className="h-4 w-4" />}
              title="Pest Type"
            />

            <RelationshipArrow />

            <RelationshipItem
              icon={<FlaskConical className="h-4 w-4" />}
              title="Solution"
            />

            <RelationshipArrow />

            <RelationshipItem
              icon={<span className="text-xs font-bold">D</span>}
              title="Dose"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function RelationshipItem({
  icon,
  title,
}: {
  icon: React.ReactNode;
  title: string;
}) {
  return (
    <div className="flex min-w-[140px] items-center gap-2 rounded-lg border bg-background px-4 py-3">
      <div className="flex h-7 w-7 items-center justify-center rounded-md bg-muted">
        {icon}
      </div>

      <span className="text-sm font-medium">{title}</span>
    </div>
  );
}

function RelationshipArrow() {
  return (
    <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
  );
}