const test=require('node:test');
const assert=require('node:assert/strict');
const core=require('../carscope-core.js');
const {mgZs2019}=require('./fixtures.js');
const NOW=new Date('2026-10-20T09:00:00Z');
const ids=r=>core.computeRiskSignals(r,NOW).map(s=>s.id);

test('28845001 fixture: dealer and low odometer, nothing invented',()=>{
 const signals=core.computeRiskSignals(mgZs2019(),NOW);
 assert.deepEqual(signals.map(s=>s.id).sort(),['dealer_owned','odometer_low']);
 const odo=signals.find(s=>s.id==='odometer_low');
 assert.ok(odo.evidence.some(e=>e.value==='22,653'&&e.source==='mileage'));
 assert.ok(odo.evidence.some(e=>/14,700/.test(e.value)&&e.source==='cbs'));
 const dealer=signals.find(s=>s.id==='dealer_owned');
 assert.ok(dealer.evidence.some(e=>e.value==='סוחר'&&e.source==='registration'));
});
test('flags an ownership held under 3 months with both records as evidence',()=>{
 const r=mgZs2019({history:{lastMileage:22653,ownership:[{date:'202001',type:'פרטי'},{date:'202003',type:'פרטי'}]}});
 const s=core.computeRiskSignals(r,NOW).find(x=>x.id==='rapid_ownership');
 assert.ok(s);
 assert.equal(s.evidence.length,2);
 assert.match(s.detail,/2 חודשים/);
});
test('3 months or more is not rapid',()=>{
 const r=mgZs2019({history:{lastMileage:22653,ownership:[{date:'202001',type:'פרטי'},{date:'202004',type:'פרטי'}]}});
 assert.ok(!ids(r).includes('rapid_ownership'));
});
test('high odometer relative to CBS average',()=>{
 const r=mgZs2019({history:{lastMileage:160000,ownership:[]}});
 assert.ok(ids(r).includes('odometer_high'));
});
test('average odometer raises no odometer signal',()=>{
 const r=mgZs2019({history:{lastMileage:100000,ownership:[]}});
 assert.ok(!ids(r).some(i=>i.startsWith('odometer')));
});
test('no odometer signal without a test date or first-road date',()=>{
 const r=mgZs2019();r.vehicle.lastTestDate=null;
 assert.ok(!ids(r).some(i=>i.startsWith('odometer')));
});
test('test expiring within 60 days, and already expired',()=>{
 const r=mgZs2019();r.vehicle.registrationExpiry='2026-12-01';
 const s=core.computeRiskSignals(r,NOW).find(x=>x.id==='test_expiring');
 assert.ok(s);assert.match(s.detail,/42 ימים/);
 r.vehicle.registrationExpiry='2026-10-01';
 assert.ok(ids(r).includes('test_expired'));
 r.vehicle.registrationExpiry='2027-01-01';
 assert.ok(!ids(r).some(i=>i.startsWith('test_')));
});
test('open recalls and cancelled record are high and listed first',()=>{
 const r=mgZs2019({datasets:{
  recalls:{status:'found',records:[{RECALL_ID:123,TEUR_TAKALA:'כרית אוויר',TAARICH_PTICHA:'2024-01-01'}]},
  cancelled:{status:'found',records:[{bitul_dt:'2025-02-01',bitul_nm:'אובדן גמור'}]}}});
 const s=core.computeRiskSignals(r,NOW);
 assert.equal(s[0].level,'high');
 assert.ok(s.find(x=>x.id==='open_recalls').evidence[0].value.includes('כרית אוויר'));
 assert.ok(s.find(x=>x.id==='cancelled').evidence[0].value.includes('אובדן גמור'));
});
test('empty report produces no signals',()=>{
 assert.deepEqual(core.computeRiskSignals({plate:'1234567'},NOW),[]);
});
test('parses government date formats',()=>{
 assert.equal(core.parseGovDate('2019-6').toISOString().slice(0,10),'2019-06-01');
 assert.equal(core.parseGovDate('202305').toISOString().slice(0,10),'2023-05-01');
 assert.equal(core.parseGovDate('2026-03-10T00:00:00').toISOString().slice(0,10),'2026-03-10');
 assert.equal(core.parseGovDate(''),null);
});
