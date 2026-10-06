import { SummaryClient } from "./SummaryClient";

export default async function SummaryPage({ params }: PageProps<"/patients/[an]">) {
  const { an } = await params;
  return <SummaryClient an={an} />;
}
