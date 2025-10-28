import { Suspense } from "react";
import PaperClient from "./PaperClient";

export default function PaperDetailPage() {
  return (
    <Suspense fallback={null}>
      <PaperClient />
    </Suspense>
  );
}


