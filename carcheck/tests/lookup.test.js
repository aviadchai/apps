const test=require('node:test');
const assert=require('node:assert/strict');
const core=require('../carscope-core.js');
const D=core.DATASETS;

// Fake CKAN: maps resource id -> {fields, rows | error}
function fakeQuery(db,log=[]){
 return async p=>{
  log.push(p);
  const t=db[p.resource_id];
  if(!t||t.error)throw new Error(t?.error||'HTTP 500');
  if(p.limit===0)return {records:[],fields:t.fields};
  const [k,v]=Object.entries(p.filters||{})[0]||[];
  if(k&&!t.fields.some(f=>f.id===k))throw new Error('HTTP 409 unknown field');
  const rows=t.rows.filter(r=>Object.entries(p.filters).every(([a,b])=>r[a]===b));
  return {records:rows,fields:t.fields};
 };
}
const f=(...ids)=>ids.map(id=>({id,type:'int'}));

test('runs all datasets, tolerates failures, joins spec by trim',async()=>{
 const db={
  [D.registration.id]:{fields:f('mispar_rechev','tozeret_cd','degem_cd','shnat_yitzur'),rows:[{mispar_rechev:28845001,tozeret_cd:1,degem_cd:2,shnat_yitzur:2019,ramat_gimur:'COMFORT'}]},
  [D.mileage.id]:{fields:f('mispar_rechev'),rows:[{mispar_rechev:28845001,kilometer_test_aharon:22653}]},
  [D.ownership.id]:{error:'timeout'},
  [D.recalls.id]:{fields:f('MISPAR_RECHEV'),rows:[]},
  [D.tires.id]:{fields:f('mispar_rechev'),rows:[]},
  [D.cancelled.id]:{fields:f('mispar_rechev'),rows:[]},
  [D.disabledTag.id]:{fields:[{id:'MISPAR RECHEV',type:'text'}],rows:[{'MISPAR RECHEV':'28845001'}]},
  [D.personalImport.id]:{fields:f('mispar_rechev'),rows:[]},
  [D.spec.id]:{fields:f('tozeret_cd','degem_cd','shnat_yitzur'),rows:[
   {tozeret_cd:1,degem_cd:2,shnat_yitzur:2019,ramat_gimur:'COMFORT',koah_sus:106},
   {tozeret_cd:1,degem_cd:2,shnat_yitzur:2019,ramat_gimur:'LUXURY',koah_sus:143}]}
 };
 const ds=await core.lookupPlate('28845001',{query:fakeQuery(db)});
 assert.equal(ds.registration.status,'found');
 assert.equal(ds.ownership.status,'error');
 assert.equal(ds.recalls.status,'empty');
 assert.equal(ds.disabledTag.status,'found');
 assert.equal(ds.spec.status,'found');
 assert.equal(ds.spec.trimMatched,true);
 assert.deepEqual(ds.spec.records.map(r=>r.koah_sus),[106]);
 for(const k of Object.keys(D))assert.ok(ds[k].fetchedAt,'fetchedAt for '+k);
});
test('retries with the real schema when the documented plate field is wrong',async()=>{
 const db={[D.recalls.id]:{fields:[{id:'mispar_rechev',type:'int'}],rows:[{mispar_rechev:1234567,RECALL_ID:9}]}};
 const ds=await core.lookupPlate('1234567',{query:fakeQuery(db),kinds:['recalls']});
 assert.equal(ds.recalls.status,'found');
 assert.match(ds.recalls.url,/mispar_rechev/);
});
test('spec is skipped, not guessed, when registration lacks join keys',async()=>{
 const db={[D.registration.id]:{fields:f('mispar_rechev'),rows:[{mispar_rechev:1234567}]}};
 const ds=await core.lookupPlate('1234567',{query:fakeQuery(db),kinds:['registration','spec']});
 assert.equal(ds.spec.status,'skipped');
});
test('starts the plate datasets in parallel',async()=>{
 let inFlight=0,peak=0;
 const q=async p=>{inFlight++;peak=Math.max(peak,inFlight);await new Promise(r=>setTimeout(r,10));inFlight--;return {records:[],fields:[{id:'mispar_rechev',type:'int'}]}};
 await core.lookupPlate('1234567',{query:q,kinds:['mileage','ownership','recalls','tires','cancelled']});
 assert.equal(peak,5);
});
test('findPlateField and plateValue follow the schema',()=>{
 assert.equal(core.findPlateField([{id:'x'},{id:'MISPAR RECHEV'}]),'MISPAR RECHEV');
 assert.equal(core.findPlateField([{id:'x'}]),null);
 assert.equal(core.plateValue('1234567',{type:'text'}),'1234567');
 assert.equal(core.plateValue('1234567',{type:'int4'}),1234567);
});
