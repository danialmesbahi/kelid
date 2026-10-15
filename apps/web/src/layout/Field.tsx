import { Icon } from '@kelid/ui';

/** نشان فیلد ضروری کنار نام آن. */
export function Req() {
  return (
    <span className="req" title="ضروری" aria-hidden="true">
      *
    </span>
  );
}

/** پیام خطای خود کلید زیر فیلد، به جای پیام انگلیسی مرورگر. */
export function FieldError({ id, text }: { id: string; text?: string }) {
  if (!text) return null;
  return (
    <span id={id} className="ferr" role="alert">
      <Icon name="warn" size="s" />
      {text}
    </span>
  );
}
