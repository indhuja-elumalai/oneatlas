import { EmptyState } from "@/components/ui";
export default function NotFound() {
  return <EmptyState title="Page not found" hint="That model, lab or provider doesn't exist in OneAtlas." href="/models" cta="Browse models →" />;
}
