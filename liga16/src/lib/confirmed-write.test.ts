import {describe,it,expect} from 'vitest';
import {requireWrittenRow} from './confirmed-write';
describe('confirmed single-row mutation',()=>{
 it.each([null,[],[{id:'a'},{id:'b'}]])('does not report success for absent or ambiguous mutation %j',data=>{
  expect(()=>requireWrittenRow(data)).toThrow('No se confirmó');
 });
 it('rejects the wrong affected identity',()=>expect(()=>requireWrittenRow([{id:'b'}],'a')).toThrow());
 it('accepts the exact acknowledged row',()=>expect(requireWrittenRow([{id:'a'}],'a')).toEqual({id:'a'}));
});
