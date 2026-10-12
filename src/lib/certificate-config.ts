// What the certificate shows besides the learner and the course. There is no
// settings screen yet (a later phase adds one); until then edit this file.
// Images live under public/ and are given as a path from the site root.
export const certificateConfig = {
  organisationName: "EdX Learning",
  // e.g. "/certificate/logo.png". With none, the name is set in large type instead.
  logoPath: null as string | null,
  signatoryName: "The EdX Learning Team",
  signatoryTitle: "Learning & Development",
  // e.g. "/certificate/signature.png". With none, the signatory name is set in script type.
  signaturePath: null as string | null,
  title: "Certificate of Completion",
};
