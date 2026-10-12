'use strict';
const RESOURCES = Object.freeze({
  registration: '053cea08-09bc-40ec-8f7a-156f0677aff3',
  mileage: '56063a99-8a3e-4ff4-912e-5966c0279bad',
  ownership: 'bb2355dc-9ec7-4f06-9c3f-3344672171da'
});
const ENDPOINT='https://data.gov.il/api/3/action/datastore_search';
function normalizedPlate(value){
  const p=String(value||'').replace(/[^0-9]/g,'');
  if(!/^\d{7,8}$/.test(p))return null;
  return p;
}
async function records(kind,plate) {
  const url=new URL(ENDPOINT);
  url.searchParams.set('resource_id',RESOURCES[kind]);
  url.searchParams.set('filters',JSON.stringify({mispar_rechev:Number(plate)}));
  url.searchParams.set('limit',kind==='ownership'?'250':'3');
  const resp=await fetch(url.toString(),{headers:{Accept:'application/json'},signal:AbortSignal.timeout(12000)});
  if(!resp.ok)throw Error('Upstream HTTP '+resp.status);
  const json=await resp.json();
  if(json.success!==true||!Array.isArray(json.result?.records))throw Error('Unexpected upstream response');
  return json.result.records;
}
function vehicleData(r){
  if(!r)return null;
  return {
    manufacturer:r.tozeret_nm||null,model:r.kinuy_mishari||null,trim:r.ramat_gimur||null,
    year:r.shnat_yitzur||null,engineCode:r.degem_manoa||null,
    fuel:r.sug_delek_nm||null,color:r.tzeva_rechev||null,
    currentOwnership:r.baalut||null,lastTestDate:r.mivchan_acharon_dt||null,
    registrationExpiry:r.tokef_dt||null,firstOnRoad:r.moed_aliya_lakvish||null,
    frontTire:r.zmig_kidmi||null
  };
}
async function handler(req,res){
  res.setHeader('Content-Type','application/json; charset=utf-8');
  res.setHeader('Cache-Control','public, s-maxage=1800, stale-while-revalidate=7200');
  if(req.method!=='GET')return res.status(405).json({error:'השירות תומך בבקשות GET בלבד'});
  const plate=normalizedPlate(req.query?.plate);
  if(!plate)return res.status(400).json({error:'מספר רכב חייב לכלול 7 או 8 ספרות'});
  const kinds=Object.keys(RESOURCES);
  const results=await Promise.allSettled(kinds.map(kind=>records(kind,plate)));
  const sources={};const found={};
  for(let i=0;i<kinds.length;i++){
    const k=kinds[i],r=results[i];
    sources[k]=r.status==='rejected'?'error':r.value.length?'found':'empty';
    found[k]=r.status==='fulfilled'?r.value:[];
  }
  if(kinds.every(k=>sources[k]==='error'))return res.status(503).json({error:'מאגרי משרד התחבורה אינם זמינים כרגע. נסה שוב מאוחר יותר.',sources});
  const rawMileage=found.mileage[0]?.kilometer_test_aharon;
  const km=rawMileage===undefined||rawMileage===null||rawMileage===''?null:Number(rawMileage);
  const owners=found.ownership.map(r=>({date:String(r.baalut_dt||''),type:r.baalut||null}))
    .sort((a,b)=>a.date.localeCompare(b.date));
  return res.status(200).json({
    plate,checkedAt:new Date().toISOString(),
    vehicle:vehicleData(found.registration[0]),
    history:{lastMileage:Number.isFinite(km)?km:null,ownership:owners},
    sources,
    coverage:{historyStartYear:2017,mileageSeriesAvailable:false},
    disclaimer:'מידע ציבורי חלקי; אין לראות בו אישור למצב מכני, היעדר תאונות או מספר ידיים סופי.'
  });
}
module.exports=handler;
module.exports.normalizedPlate=normalizedPlate;
module.exports.vehicleData=vehicleData;
