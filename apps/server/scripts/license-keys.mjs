// یک جفت کلید تازه برای امضای مجوز اشتراک. کلید خصوصی فقط در ‎.env‎ سرور؛ کلید عمومی در ساخت برنامه.
// بعد از عوض کردن کلید، دستگاه‌ها با اولین سر زدن به سرور مجوز تازه می‌گیرند.
import { createPrivateKey, createPublicKey, randomBytes } from 'node:crypto';

const seed = randomBytes(32);
const key = createPrivateKey({ key: Buffer.concat([Buffer.from('302e020100300506032b657004220420', 'hex'), seed]), format: 'der', type: 'pkcs8' });
const pub = createPublicKey(key).export({ format: 'der', type: 'spki' }).subarray(-32);
console.log('# server .env (keep secret, never commit):');
console.log(`LICENSE_PRIVATE_KEY=${seed.toString('base64url')}`);
console.log('# web/desktop build env:');
console.log(`VITE_KELID_LICENSE_KEY=${pub.toString('base64url')}`);
