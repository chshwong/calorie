/**
 * DEV-ONLY: Seeds legal_documents using SUPABASE_SERVICE_ROLE_KEY.
 * Never run in client/runtime. Never ship service role key.
 */


import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

type DocType = 'terms' | 'privacy' | 'health_disclaimer';

function mustGetEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

async function main() {
  // Use SERVICE ROLE key so the script can write regardless of RLS
  const supabaseUrl = mustGetEnv('SUPABASE_URL');
  const serviceRoleKey = mustGetEnv('SUPABASE_SERVICE_ROLE_KEY');

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  // 🔎 Sanity check: confirm we can read from legal_documents
const { data: probe, error: probeError } = await supabase
  .from('legal_documents')
  .select('doc_type, version, is_active')
  .limit(5);

if (probeError) {
  throw probeError;
}

console.log('Connected to Supabase. Existing legal_documents rows:', probe);


  const version = '2025-12-22'; // bump later when you change legal text

  const baseDir = path.resolve(process.cwd(), 'legal', 'en');

  const docs: Array<{
    doc_type: DocType;
    version: string;
    title: string;
    content_md: string;
    is_active: boolean;
  }> = [
    {
      doc_type: 'terms',
      version,
      title: 'Terms of Service',
      content_md: fs.readFileSync(path.join(baseDir, 'terms-of-service.md'), 'utf8'),
      is_active: true,
    },
    {
      doc_type: 'privacy',
      version,
      title: 'Privacy Policy',
      content_md: fs.readFileSync(path.join(baseDir, 'privacy-policy.md'), 'utf8'),
      is_active: true,
    },
    {
      doc_type: 'health_disclaimer',
      version,
      title: 'Health & Medical Disclaimer',
      content_md: fs.readFileSync(path.join(baseDir, 'health-medical-disclaimer.md'), 'utf8'),
      is_active: true,
    },
  ];

  // 1) Deactivate existing active docs for these types + locale
  for (const d of docs) {
    const { error } = await supabase
      .from('legal_documents')
      .update({ is_active: false })
      .eq('doc_type', d.doc_type)
      .eq('is_active', true);

    if (error) throw error;
  }

// Make seeding idempotent without relying on UNIQUE constraints:
// delete the same version for each doc_type, then insert fresh.
for (const d of docs) {
    const { error: delError } = await supabase
      .from('legal_documents')
      .delete()
      .eq('doc_type', d.doc_type)
      .eq('version', d.version);
  
    if (delError) throw delError;
  }
  
  const { data: inserted, error: insertError } = await supabase
    .from('legal_documents')
    .insert(docs)
    .select('doc_type, version, is_active');
  
  if (insertError) throw insertError;
  
  console.log('Inserted rows:', inserted);
  console.log('✅ Seeded legal_documents successfully:', docs.map(d => `${d.doc_type}:${d.version}`));
}

main().catch((err) => {
  console.error('❌ seed-legal-docs failed:', err);
  process.exit(1);
});
