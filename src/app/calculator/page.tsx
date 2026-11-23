import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { CostCalculator } from "@/components/cost-calculator";

export const metadata: Metadata = { title: "Cost calculator" };

export default function CalculatorPage() {
  return (
    <div>
      <PageHeader
        title="Cost calculator"
        subtitle="Enter your workload and see what it would cost per month on every model, using each model's cheapest provider."
      />
      <CostCalculator />
    </div>
  );
}
