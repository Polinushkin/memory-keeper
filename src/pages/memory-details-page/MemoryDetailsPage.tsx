import { Navigate, useParams, useSearchParams } from "react-router-dom";
import { MemoryDetailsView } from "../../widgets/memory-details-view";

export default function MemoryDetailsPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();

  if (!id) {
    return <Navigate to="/memories" replace />;
  }

  const returnTo = searchParams.get("returnTo") || "/memories";

  return (
    <MemoryDetailsView
      memoryId={id}
      returnUrl={returnTo}
    />
  );
}
