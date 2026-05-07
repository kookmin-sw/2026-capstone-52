import DashboardPageView from "../../components/dashboard/dashboard-page-view";

export default async function DashboardPage({ searchParams }) {
  const resolvedSearchParams = await searchParams;
  const projectId = resolvedSearchParams?.projectId
    ? decodeURIComponent(resolvedSearchParams.projectId)
    : null;
  const chatId = resolvedSearchParams?.chatId
    ? decodeURIComponent(resolvedSearchParams.chatId)
    : null;

  return <DashboardPageView initialProjectId={projectId} initialChatId={chatId} />;
}
