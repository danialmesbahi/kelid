import { useNavigate } from 'react-router';
import { formatPlaque } from '@kelid/core';
import { useStore } from '../data';
import { useToast } from '../layout/Toasts';
import { ListingForm } from './ListingForm';

export function AddPage() {
  const store = useStore();
  const navigate = useNavigate();
  const toast = useToast();
  return (
    <ListingForm
      title="فایل جدید"
      submitLabel="ثبت فایل"
      cancelTo="/files"
      photoNote
      onSubmit={async (fields) => {
        const listing = await store.addListing({ ...fields, cover: (['f', 'g', 'i', 'j'] as const)[Math.floor(Math.random() * 4)]!, photoCount: 0 });
        navigate(`/files/${listing.id}`, { replace: true, viewTransition: true });
        toast(`فایل ${formatPlaque(listing.plaque)} ثبت شد`);
      }}
    />
  );
}
