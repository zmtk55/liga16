import {describe,it,expect} from 'vitest';
import {parsePaymentCents} from './payment-input';
describe('individual manual payment amount',()=>{
 it.each([['',null],['0',0],[' 750.50 ',75050],['1.2',120],['21474836.47',2147483647]] as const)('parses %s without guessing tariff',(s,n)=>expect(parsePaymentCents(s)).toBe(n));
 it.each(['-1','1.001','NaN','Infinity','1e3','1,000','21474836.48','999999999999999999'])('rejects invalid or overflowing %s',s=>expect(()=>parsePaymentCents(s)).toThrow());
});
