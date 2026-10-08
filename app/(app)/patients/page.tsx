import { Suspense } from "react";
import { Spinner } from "@/components/ui";
import { appMode } from "@/lib/env";
import { Workspace } from "./Workspace";

export default function PatientsPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <Workspace mode={appMode()} />
    </Suspense>
  );
}
