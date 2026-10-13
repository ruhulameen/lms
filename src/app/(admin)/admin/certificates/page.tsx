import type { Metadata } from "next";
import Link from "next/link";
import { Ban, CircleCheck, ExternalLink, RotateCcw } from "lucide-react";
import { restoreCertificate, revokeCertificate } from "@/actions/certificate-admin";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { DataTable, DataTableToolbar, FilterSelect, type DataTableColumn } from "@/components/admin/data-table";
import { PageHeader } from "@/components/admin/page-header";
import { StatusBadge } from "@/components/admin/status-badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/activity-details";
import { firstParam, intParam, sortParams, type SearchParams } from "@/lib/table-params";
import { CERTIFICATE_SORT_KEYS, listCertificates } from "@/services/certificate";
import { can, requirePermission } from "@/services/user";

export const metadata: Metadata = { title: "Certificates" };

export default async function CertificatesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const viewer = await requirePermission("certificate.view");
  const params = await searchParams;
  const status = firstParam(params.status) === "VALID" ? "VALID" : firstParam(params.status) === "REVOKED" ? "REVOKED" : undefined;
  const sort = sortParams(params, CERTIFICATE_SORT_KEYS, { sort: "issued", order: "desc" });
  // `course` narrows the list to one course (linked from the course overview).
  const courseId = intParam(params.course, 0) || undefined;
  const list = await listCertificates({ search: firstParam(params.q), status, courseId, page: intParam(params.page), ...sort });
  const canManage = can(viewer, "certificate.manage");

  type Row = (typeof list.rows)[number];
  const columns: DataTableColumn<Row>[] = [
    {
      key: "learner",
      header: "Learner",
      sortable: true,
      cell: (c) => (
        <div className="min-w-0">
          {can(viewer, "enrolment.view") ? (
            <Link href={`/admin/learners/${c.user.id}`} className="font-medium text-blue-700 hover:underline">
              {c.learnerName}
            </Link>
          ) : (
            <span className="font-medium">{c.learnerName}</span>
          )}
          <p className="truncate text-xs text-slate-500">{c.user.email}</p>
        </div>
      ),
    },
    { key: "course", header: "Course", sortable: true, cell: (c) => c.courseTitle },
    { key: "code", header: "Certificate ID", sortable: true, cell: (c) => <span className="font-mono text-xs">{c.code}</span> },
    { key: "issued", header: "Issued", sortable: true, cell: (c) => formatDate(c.issuedAt) },
    {
      key: "status",
      header: "Status",
      sortable: true,
      cell: (c) =>
        c.revokedAt ? (
          <span>
            <StatusBadge label="Revoked" tone="danger" icon={Ban} />
            <span className="mt-0.5 block text-xs text-slate-500">
              {formatDate(c.revokedAt)}
              {c.revokedBy ? ` by ${c.revokedBy.name}` : ""}
            </span>
          </span>
        ) : (
          <StatusBadge label="Valid" tone="success" icon={CircleCheck} />
        ),
    },
    {
      key: "actions",
      header: "Actions",
      cell: (c) => (
        <div className="flex flex-wrap gap-1.5">
          <Button variant="outline" size="sm" render={<Link href={`/certificates/${c.code}`} target="_blank" />}>
            <ExternalLink aria-hidden /> View
          </Button>
          {canManage &&
            (c.revokedAt ? (
              <ConfirmDialog
                action={restoreCertificate}
                fields={{ certificateId: String(c.id) }}
                title="Restore this certificate?"
                description={`The certificate for ${c.learnerName} will be valid again, and its public page will show the certificate.`}
                trigger={<><RotateCcw aria-hidden /> Restore</>}
                confirmLabel="Restore certificate"
              />
            ) : (
              <ConfirmDialog
                action={revokeCertificate}
                fields={{ certificateId: String(c.id) }}
                title="Revoke this certificate?"
                description={`The certificate for ${c.learnerName} will stop being valid. Its public page will say it has been revoked and the learner will no longer see it. You can restore it later.`}
                trigger={<><Ban aria-hidden /> Revoke</>}
                triggerVariant="destructive"
                confirmLabel="Revoke certificate"
                destructive
              />
            ))}
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader title="Certificates" description="Issued automatically when a learner finishes a course. Anyone with a certificate's ID can verify it." />
      <DataTable
        caption="Certificates"
        columns={columns}
        rows={list.rows}
        rowKey={(c) => c.id}
        basePath="/admin/certificates"
        searchParams={params}
        sort={sort}
        page={list.page}
        pageSize={list.pageSize}
        total={list.total}
        emptyTitle="No certificates found"
        emptyDescription="Certificates appear here when learners complete a course."
        toolbar={
          <DataTableToolbar basePath="/admin/certificates" searchParams={params} searchPlaceholder="Search learner, course or ID">
            <FilterSelect
              name="status"
              label="All certificates"
              searchParams={params}
              options={[
                { value: "VALID", label: "Valid" },
                { value: "REVOKED", label: "Revoked" },
              ]}
            />
          </DataTableToolbar>
        }
      />
    </>
  );
}
