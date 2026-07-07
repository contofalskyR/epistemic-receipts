// R2 upload script for eval set JSONL files.
//
// Usage:
//   R2_ACCOUNT_ID=... R2_ACCESS_KEY_ID=... R2_SECRET_ACCESS_KEY=... R2_BUCKET=... \
//   npx tsx packages/eval/upload-r2.ts \
//     --file eval-set-free-er-eval-v1.jsonl \
//     --public
//
// Requires: @aws-sdk/client-s3 (already in dependencies)

import * as fs from 'fs'
import * as path from 'path'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'

function parseArgs() {
  const args = process.argv.slice(2)
  const get = (flag: string) => {
    const i = args.findIndex(a => a === flag)
    return i >= 0 ? args[i + 1] : args.find(a => a.startsWith(`${flag}=`))?.split('=').slice(1).join('=')
  }
  return {
    filePath: get('--file') ?? '',
    publicAccess: args.includes('--public'),
    prefix: get('--prefix') ?? 'eval/',
  }
}

async function main() {
  const { filePath, publicAccess, prefix } = parseArgs()
  if (!filePath) throw new Error('--file required')

  const accountId = process.env.R2_ACCOUNT_ID
  const accessKeyId = process.env.R2_ACCESS_KEY_ID
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY
  const bucket = process.env.R2_BUCKET
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
    throw new Error('R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET env vars required')
  }

  const client = new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  })

  const key = `${prefix}${path.basename(filePath)}`
  const body = fs.readFileSync(filePath)

  await client.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: body,
    ContentType: 'application/jsonl',
    ...(publicAccess ? { ACL: 'public-read' } : {}),
  }))

  console.log(`Uploaded to R2: ${bucket}/${key}`)
  if (publicAccess) {
    console.log(`Public URL: https://<your-r2-custom-domain>/${key}`)
    console.log('(Replace <your-r2-custom-domain> with your bucket public domain)')
  }
}

main().catch(e => { console.error(e); process.exit(1) })
