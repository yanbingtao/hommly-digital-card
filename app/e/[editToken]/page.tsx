import { loadEditPageContext } from '@/lib/edit-page-loader';
import { SharedCardEditor } from '@/components/card/SharedCardEditor';
import { IndividualRecipientManager } from '@/components/individual/IndividualRecipientManager';
import {
  EditPageExpired,
  EditPageIndividualLoadError,
  EditPageNotFound,
} from '@/components/card/EditPageStateViews';

export const dynamic = 'force-dynamic';

type EditCardPageProps = {
  params: { editToken: string };
};

export default async function EditCardPage({ params }: EditCardPageProps) {
  const context = await loadEditPageContext(params.editToken);

  if (context.kind === 'not_found') {
    return <EditPageNotFound />;
  }

  if (context.kind === 'expired') {
    return <EditPageExpired expiredOn={context.expiredOn} />;
  }

  if (context.kind === 'individual_load_error') {
    return <EditPageIndividualLoadError />;
  }

  if (context.kind === 'individual') {
    return (
      <IndividualRecipientManager
        editToken={params.editToken}
        initialRecipients={context.recipients}
      />
    );
  }

  return <SharedCardEditor editToken={context.editToken} />;
}
