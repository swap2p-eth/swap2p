import { Dashboard } from "@/components/dashboard";
import { mockDeals } from "@/lib/mock-data";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-background px-4 py-8 sm:px-6 lg:px-8">
      <Dashboard deals={mockDeals} />
    </main>
  );
}
