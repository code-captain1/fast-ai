// app/dashboard/page.tsx
import { DashboardHeader } from "@/components/dashboard-header";
import { AIAssistantInterface } from "@/components/ui/ai-assistant-interface";

export default function DashBoard() {
  return (
    <div className="w-screen">
      <DashboardHeader />
      <AIAssistantInterface />
    </div>
  );
}
