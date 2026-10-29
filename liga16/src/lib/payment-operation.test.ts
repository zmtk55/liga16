import {describe,it,expect,vi} from 'vitest';
import {preparePaymentOperation,type PendingPaymentOperation} from './payment-operation';
describe('payment operation retained across unknown response',()=>{
 it('keeps same id on retry after network failure',()=>{const pending:{current:PendingPaymentOperation|null}={current:null};const id=vi.fn(()=> 'op');const a=preparePaymentOperation(pending,3,{amount:100},id);expect(preparePaymentOperation(pending,3,{amount:100},id)).toEqual(a);expect(id).toHaveBeenCalledTimes(1);});
 it('does not replace an unknown operation with changed money',()=>{const pending:{current:PendingPaymentOperation|null}={current:null};preparePaymentOperation(pending,1,{amount:100},()=> 'op');expect(()=>preparePaymentOperation(pending,1,{amount:200})).toThrow('sin confirmar');});
 it.each([undefined,-1,0.5])('requires server revision %s',revision=>expect(()=>preparePaymentOperation({current:null},revision,{})).toThrow('revisión'));
});
