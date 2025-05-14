import { requireAuth } from "../components/auth-status";
import FetchDataSteps from "@/components/tutorial/fetch-data-steps";
import { InfoIcon } from "lucide-react";

export default async function ProtectedPage() {
  const session = await requireAuth();

  return (
    <div className="flex-1 w-full flex flex-col gap-12">
      <div className="w-full">
        <div className="bg-accent text-sm p-3 px-5 rounded-md text-foreground flex gap-3 items-center">
          <InfoIcon size="16" strokeWidth={2} />
          Welcome, {session.user.email}
        </div>
      </div>
      <div className="flex flex-col gap-2 items-start">
        <h2 className="font-bold text-2xl mb-4">User Details</h2>
        <pre className="text-xs font-mono p-3 rounded border max-h-32 overflow-auto">
          {JSON.stringify(session.user, null, 2)}
        </pre>
      </div>
      <div>
        <h2 className="font-bold text-2xl mb-4">Next Steps</h2>
        <FetchDataSteps />
      </div>
    </div>
  );
}
