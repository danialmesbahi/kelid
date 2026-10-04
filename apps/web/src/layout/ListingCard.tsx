import { Cover, Icon, Plaque } from '@kelid/ui';
import { dealLabel, floorLabel, headlinePrice, listingTitle, secondaryPrice, toFaDigits, type Listing } from '@kelid/core';

/**
 * محتوای کارت فایل (عکس + جزئیات) که امروز و فایل‌ها هر دو استفاده می‌کنند؛ قاب بیرونی (لینک یا دکمه) با خود صفحه است.
 * `flyName` فقط روی کارتی که در حال باز شدن است داده می‌شود تا فقط عکس همان کارت به پرونده پرواز کند.
 */
export function ListingCardContent({ l, cover, badge, flyName }: { l: Listing; cover: string | undefined; badge?: string; flyName?: string }) {
  return (
    <>
      <span className="pcard-media">
        {/* فقط خود عکس پرواز می‌کند؛ برچسب‌ها بیرون از آن‌اند تا وسط راه بزرگ و کش نیایند */}
        <span className="pcard-ph vt-cover" style={{ viewTransitionName: flyName }}>
          <Cover variant={l.cover} src={cover} />
        </span>
        <span className="pcard-tags">
          <Plaque value={l.plaque} deal={l.deal} />
          <span className={`pcard-deal d-${l.deal}`}>{dealLabel[l.deal]}</span>
        </span>
        {badge && <span className="pcard-st">{badge}</span>}
        {l.photoCount > 0 && (
          <span className="pcard-cnt num">
            <Icon name="cam" size="s" />
            {toFaDigits(l.photoCount)}
          </span>
        )}
      </span>
      <span className="pcard-bd">
        <span className="pcard-t">{listingTitle(l)}</span>
        <span className="pcard-loc">
          <Icon name="pin" size="s" />
          {l.neighborhood}
          {l.street ? `، ${l.street}` : ''}
        </span>
        <span className="pcard-facts">
          <b className="num">{toFaDigits(l.area)}</b> متر · <b className="num">{toFaDigits(l.bedrooms)}</b> خواب
          {l.floor !== undefined && (
            <>
              {' '}
              · طبقهٔ <b className="num">{floorLabel(l)}</b>
            </>
          )}
        </span>
        <span className="pcard-ft">
          <span style={{ minWidth: 0 }}>
            <b className="num">{headlinePrice(l)}</b>
            <small className="num">{secondaryPrice(l)}</small>
          </span>
          <span className="pcard-go" aria-hidden="true">
            <Icon name="chl" size="s" />
          </span>
        </span>
      </span>
    </>
  );
}
