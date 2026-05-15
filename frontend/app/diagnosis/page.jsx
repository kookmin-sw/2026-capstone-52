import DiagnosisPageView from "../../components/diagnosis/diagnosis-page-view";

export default async function DiagnosisPage({ searchParams }) {
  const resolvedSearchParams = await searchParams;
  const projectId = resolvedSearchParams?.projectId
    ? decodeURIComponent(resolvedSearchParams.projectId)
    : "os";

  return <DiagnosisPageView projectId={projectId} />;
}
