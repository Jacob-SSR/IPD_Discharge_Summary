import { Suspense } from "react";
import { Spinner } from "@/components/ui";
import { PatientsClient } from "./PatientsClient";

export default function PatientsPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <PatientsClient />
    </Suspense>
  );
}
