import UploadPageView from "../../components/upload/upload-page-view";

export default async function UploadPage({ searchParams }) {
  const resolvedSearchParams = await searchParams;
  const projectId = resolvedSearchParams?.projectId
    ? decodeURIComponent(resolvedSearchParams.projectId)
    : null;

  return <UploadPageView initialProjectId={projectId} />;
}
