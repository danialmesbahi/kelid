import { Link, useParams } from 'react-router';
import { formatPlaque } from '@kelid/core';
import { useQuery, useStore } from '../data';
import { useGoBack } from '../layout/useGoBack';
import { PageSkeleton } from '../layout/PageSkeleton';
import { useToast } from '../layout/Toasts';
import { ListingForm } from './ListingForm';

/** ویرایش فایل با همان فرم ثبت؛ پلاک ثابت می‌ماند. */
export function EditListingPage() {
  const { id = '' } = useParams();
  const store = useStore();
  const goBack = useGoBack();
  const toast = useToast();
  const data = useQuery(`file-edit:${id}`, async (s) => ({ l: await s.getListing(id) }));

  if (!data) return <PageSkeleton />;
  const l = data.l;
  if (!l) {
    return (
      <div className="bd" style={{ paddingTop: 40 }}>
        <h1 className="t1">این فایل پیدا نشد</h1>
        <Link viewTransition className="lnk" to="/files">بازگشت به فایل‌ها</Link>
      </div>
    );
  }

  return (
    <ListingForm
      key={l.id}
      listing={l}
      showStatus
      title={`ویرایش فایل ${formatPlaque(l.plaque)}`}
      submitLabel="ذخیرهٔ تغییرات"
      cancelTo={`/files/${l.id}`}
      onSubmit={async (_fields, edited) => {
        await store.updateListing(l.id, edited);
        // ویرایش از صفحهٔ فایل باز می‌شود؛ برگشت به همان، تا «برگشت» بعدی دو بار روی یک فایل نماند.
        goBack(`/files/${l.id}`);
        toast(`تغییرات فایل ${formatPlaque(l.plaque)} ذخیره شد`);
      }}
    />
  );
}
