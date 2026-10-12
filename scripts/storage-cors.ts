// Applies the CORS rule browser uploads need to the R2 bucket: PUT from the app
// origin (BETTER_AUTH_URL), with ETag exposed so the uploader can complete
// multipart uploads. Run once per bucket (and again if the app origin changes):
//   pnpm storage:cors
import "dotenv/config";
import { GetBucketCorsCommand, PutBucketCorsCommand, S3Client } from "@aws-sdk/client-s3";

async function main() {
  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, BETTER_AUTH_URL } = process.env;
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET) {
    throw new Error("Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY and R2_BUCKET in .env first.");
  }
  if (!BETTER_AUTH_URL) throw new Error("Set BETTER_AUTH_URL in .env: it is the allowed upload origin.");
  const origin = new URL(BETTER_AUTH_URL).origin;

  const client = new S3Client({
    region: "auto",
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });

  await client.send(
    new PutBucketCorsCommand({
      Bucket: R2_BUCKET,
      CORSConfiguration: {
        CORSRules: [
          {
            AllowedOrigins: [origin],
            AllowedMethods: ["PUT"],
            AllowedHeaders: ["*"],
            ExposeHeaders: ["ETag"],
            MaxAgeSeconds: 3600,
          },
        ],
      },
    }),
  );
  const applied = await client.send(new GetBucketCorsCommand({ Bucket: R2_BUCKET }));
  console.log(`CORS applied to ${R2_BUCKET} for ${origin}:`, JSON.stringify(applied.CORSRules));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
