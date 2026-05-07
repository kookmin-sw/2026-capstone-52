import { redirect } from "next/navigation";

export default async function ProjectPage({ params }) {
  const resolvedParams = await params;
  const projectId = decodeURIComponent(resolvedParams.projectId);

  redirect(`/dashboard?projectId=${encodeURIComponent(projectId)}`);
}
