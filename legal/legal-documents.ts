import i18n from '@/i18n';

export type LegalDocType = 'terms' | 'privacy' | 'health_disclaimer';

export type LegalDocument = {
  docType: LegalDocType;
  version: string;
  title: string;
  contentMd: string;
  isActive: boolean;
};

const VERSION_2025_01_01 = '2025-01-01';

const t = i18n.t.bind(i18n);

export const LOCAL_LEGAL_DOCUMENTS: LegalDocument[] = [
  {
    docType: 'terms',
    version: VERSION_2025_01_01,
    title: t('onboarding.legal.terms_title'),
    isActive: true,
    contentMd: t('legal.documents.terms.content', { version: VERSION_2025_01_01 }),
  },
  {
    docType: 'privacy',
    version: VERSION_2025_01_01,
    title: t('onboarding.legal.privacy_title'),
    isActive: true,
    contentMd: t('legal.documents.privacy.content', { version: VERSION_2025_01_01 }),
  },
  {
    docType: 'health_disclaimer',
    version: VERSION_2025_01_01,
    title: t('onboarding.legal.health_disclaimer_title'),
    isActive: true,
    contentMd: t('legal.documents.health_disclaimer.content', { version: VERSION_2025_01_01 }),
  },
];

export function getLocalActiveLegalDocuments(): LegalDocument[] {
  return LOCAL_LEGAL_DOCUMENTS.filter((doc) => doc.isActive);
}






