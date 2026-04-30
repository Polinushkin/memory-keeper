import { Navigate, useParams, useSearchParams } from "react-router-dom";
import { MemoryDetailsView } from "../../widgets/memory-details-view";

export default function MemoryDetailsPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();

  if (!id) {
    return <Navigate to="/memories" replace />;
  }

  const returnQueryString = searchParams.toString();
  const returnUrl = returnQueryString ? `/memories?${returnQueryString}` : "/memories";

  return (
    <MemoryDetailsView
      memoryId={id}
      returnUrl={returnUrl}
      returnQueryString={returnQueryString}
    />
  );
}
