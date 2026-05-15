import DiagnosisPageView from "../../components/diagnosis/diagnosis-page-view";

export default async function DiagnosisPage({ searchParams }) {
  const resolvedSearchParams = await searchParams;
  const requestedProjectId = resolvedSearchParams?.projectId
    ? decodeURIComponent(resolvedSearchParams.projectId)
    : "os";
  const projectId = process.env.NEXT_PUBLIC_USE_BACKEND_API === "true" ? requestedProjectId : "os";

  return <DiagnosisPageView projectId={projectId} />;
}
