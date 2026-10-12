import { notFound, redirect } from "next/navigation";
import { parseRouteId } from "@/lib/route-id";

export default async function CourseIndexPage({ params }: { params: Promise<{ id: string }> }) {
  const id = parseRouteId((await params).id);
  if (!id) notFound();
  redirect(`/admin/courses/${id}/edit`);
}
