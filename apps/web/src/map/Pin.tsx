/** سنجاق کلید: قطرهٔ سبز با سوراخ کلید سفید؛ همان شکل در انتخاب جا و کارت فرم. */
export function PinShape({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 44 56" aria-hidden="true">
      <path className="kpin-body" d="M22 55c-1.3 0-2.4-.8-3-2C14.3 43.4 2 34.7 2 21.5 2 10.2 11 1.5 22 1.5s20 8.7 20 20c0 13.2-12.3 21.9-17 31.5-.6 1.2-1.7 2-3 2z" />
      <circle className="kpin-hole" cx="22" cy="19" r="6.5" />
      <path className="kpin-hole" d="M19.6 22.5h4.8l1.3 8.5h-7.4z" />
    </svg>
  );
}
