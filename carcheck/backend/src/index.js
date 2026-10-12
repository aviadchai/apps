import {normalizePlate,normalizeVehicle,analyzeMileage,asTestDate,parseOwners} from "./lib.js";

const SOURCE={
  registration:"053cea08-09bc-40ec-8f7a-156f0677aff3",
  mileage:"56063a99-8a3e-4ff4-912e-5966c0279bad",
  ownership:"bb2355dc-9ec7-4f06-9c3f-3344672171da"
};
const GOVERNMENT_ENDPOINT="https://data.gov.il/api/3/action/datastore_search";
const RESPONSE_SOURCE="משרד התחבורה · data.gov.il";
const LIMIT_WATCH=50;
const json=(obj,status=200,headers={})=>new Response(JSON.stringify(obj),{status,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store",...headers}});
const utc=()=>new Date().toISOString();
const errorResponse=(msg,status=400)=>json({error:msg},status);
const officialURL=(kind,plate)=>{
  const u=new URL(GOVERNMENT_ENDPOINT);
  u.searchParams.set("resource_id",SOURCE[kind]);
  u.searchParams.set("filters",JSON.stringify({mispar_rechev:Number(plate)}));
  u.searchParams.set("limit",kind==="ownership"?"150":"2");
  return u;
};
async function readGovernment(kind,plate){
  const response=await fetch(officialURL(kind,plate),{
    headers:{"Accept":"application/json"},
    signal:AbortSignal.timeout(12000)
  });
  if(!response.ok)throw Error("government_error_"+response.status);
  const data=await response.json();
  if(data.success!==true||!Array.isArray(data.result?.records))throw Error("government_invalid_response");
  return data.result.records;
}
const readSources=async plate=>{
  const types=Object.keys(SOURCE);
  const result=await Promise.allSettled(types.map(kind=>readGovernment(kind,plate)));
  const sources={},records={};
  for(let i=0;i<types.length;i++){
    let kind=types[i],r=result[i];
    records[kind]=r.status==="fulfilled"?r.value:[];
    sources[kind]=r.status==="rejected"?"error":records[kind].length?"found":"empty";
  }
  return {sources,records};
};
const validMileage=entry=>{
  const n=entry?.kilometer_test_aharon;
  if(n==null||n==="")return null;
  const numeric=Number(n);
  return Number.isInteger(numeric)&&numeric>=0&&numeric<=2500000?numeric:null;
};
async function storeObservation(db,plate,governmentMileage,vehicle){
  const n=validMileage(governmentMileage);
  if(n===null||!db)return;
  const observed=utc();
  const actualTest=asTestDate(vehicle?.lastTestDate);
  // For a missing test date, observation time is not passed off as a test date.
  const recordedDate=actualTest||observed.slice(0,10);
  const dateType=actualTest?"test_date":"first_observed_date";
  await db.prepare(
    "INSERT INTO odometer_observations (plate,mileage_km,reading_date,date_type,source,first_seen_at,last_seen_at)"+
    " VALUES (?1,?2,?3,?4,'mot_open_data',?5,?5)"+
    " ON CONFLICT (plate,mileage_km,reading_date,date_type,source) DO UPDATE SET last_seen_at = excluded.last_seen_at"
  ).bind(plate,n,recordedDate,dateType,observed).run();
  await db.prepare(
    "INSERT INTO watched_plates (plate,first_seen_at,last_checked_at,next_check_at) VALUES (?1,?2,?2,?3)"+
    " ON CONFLICT (plate) DO UPDATE SET last_checked_at=excluded.last_checked_at,next_check_at=excluded.next_check_at"
  ).bind(plate,observed,new Date(Date.now()+7*86400000).toISOString()).run();
}
async function getHistory(db,plate){
  if(!db)return [];
  const r=await db.prepare(
    "SELECT mileage_km,reading_date,date_type,source,first_seen_at,last_seen_at"+
    " FROM odometer_observations WHERE plate=?1 ORDER BY reading_date ASC,first_seen_at ASC LIMIT 60"
  ).bind(plate).all();
  return (r.results||[]).map(row=>({
    value:row.mileage_km,date:row.reading_date,
    dateType:row.date_type,source:row.source,
    verified:row.source==="mot_open_data",
    firstSeenAt:row.first_seen_at,lastSeenAt:row.last_seen_at
  }));
}
async function resultForPlate(plate,env){
  const {records,sources}=await readSources(plate);
  if(Object.values(sources).every(x=>x==="error"))
    throw new Error("all_sources_unavailable");
  const vehicle=normalizeVehicle(records.registration[0]);
  const mileageRecord=records.mileage[0]||null;
  const ownership= parseOwners(records.ownership);
  let historyReadings=[],storageStatus=env.DB?"available":"not_connected";
  if(env.DB){
    try{
      await storeObservation(env.DB,plate,mileageRecord,vehicle);
      historyReadings=await getHistory(env.DB,plate);
    }catch(e){storageStatus="error";console.warn("D1 database operation failed",String(e))}
  }
  const mileage=validMileage(mileageRecord);
  const alerts=analyzeMileage(historyReadings);
  return {
    plate,checkedAt:utc(),vehicle,
    history:{lastMileage:mileage,origin:mileageRecord?.mkoriut_nm||null,
      ownership,odometerReadings:historyReadings,
      odometerAlerts:alerts},
    sources,backend:{storageStatus,historyCoverage:"stored_observations_only",
      priorTestsGuaranteed:false,ownerHistoryExhaustive:false},
    attribution:{provider:RESPONSE_SOURCE,url:"https://data.gov.il/he/datasets/ministry_of_transport/shinui_mivne"},
    disclaimer:"רק הקריאה האחרונה מתפרסמת במקור הממשלתי. רצף ההיסטוריה מציג קריאות שנשמרו לאורך זמן, ולא בהכרח את כל הטסטים."
  };
}
async function refreshWatched(env){
  if(!env.DB)return;
  const now=utc();
  const matches=await env.DB.prepare(
    "SELECT plate FROM watched_plates WHERE next_check_at <= ?1 ORDER BY next_check_at LIMIT ?2"
  ).bind(now,LIMIT_WATCH).all();
  const plates=(matches.results||[]).map(x=>x.plate);
  for(let i=0;i<plates.length;i+=5){
    await Promise.all(plates.slice(i,i+5).map(async plate=>{
      try{
        const r=await Promise.allSettled([readGovernment("mileage",plate),readGovernment("registration",plate)]);
        const m=r[0].status==="fulfilled"?r[0].value[0]:null;
        const v=r[1].status==="fulfilled"?normalizeVehicle(r[1].value[0]):null;
        if(!m && r[0].status==="rejected")throw new Error("government_unavailable");
        await storeObservation(env.DB,plate,m,v);
      }catch(e){
        console.warn("scheduled refresh failed",plate,String(e));
        await env.DB.prepare("UPDATE watched_plates SET next_check_at=?2 WHERE plate=?1")
          .bind(plate,new Date(Date.now()+86400000).toISOString()).run();
      }
    }));
  }
}
async function getPriceEvidence(u,env){
  if(!env.DB)return errorResponse("חיבור למסד נתוני המחירים עדיין אינו מוגדר",503);
  const model=(u.searchParams.get("model")||"").trim().slice(0,120);
  const manufacturer=(u.searchParams.get("manufacturer")||"").trim().slice(0,120);
  if(!model||!manufacturer)return errorResponse("יש לספק דגם ויצרן");
  const prices=await env.DB.prepare(
    "SELECT model_year,asking_price_ils,listing_date,trim,source_name,source_url,evidence_type"+
    " FROM price_observations WHERE model_name=?1 AND manufacturer=?2"+
    " ORDER BY model_year,listing_date DESC LIMIT 300"
  ).bind(model,manufacturer).all();
  return json({manufacturer,model,observations:prices.results||[],
    methodology:"רק מודעות או עסקאות שמקורן נקלט בהיתר. מחיר מבוקש אינו מחיר עסקה.",
    notOfficialPricebook:true});
}
export default {
 async fetch(request,env,ctx){
  const u=new URL(request.url);
  const origin=request.headers.get("Origin")||"";
  const allowedOrigins=["https://aviadchai.github.io","http://localhost:8787","http://localhost:3000","http://127.0.0.1:8787"];
  const cors=allowedOrigins.includes(origin)?{
   "Access-Control-Allow-Origin":origin,"Vary":"Origin",
   "Access-Control-Allow-Methods":"GET,OPTIONS",
   "Access-Control-Allow-Headers":"Content-Type",
  }:{};
  if(request.method==="OPTIONS")return new Response(null,{status:204,headers:cors});
  if(request.method!=="GET")return errorResponse("Method not allowed",405);
  if(u.pathname==="/api/health")return json({ok:true,service:"carscope-api",database:env.DB?"configured":"unconfigured"},200,cors);
  if(u.pathname==="/api/prices"){
    const r=await getPriceEvidence(u,env);
    return new Response(r.body,{status:r.status,headers:{...Object.fromEntries(r.headers),...cors}});
  }
  if(u.pathname!=="/api/vehicle")return errorResponse("Not found",404);
  const plate=normalizePlate(u.searchParams.get("plate"));
  if(!plate)return json({error:"מספר רכב חייב להכיל 7 או 8 ספרות"},400,cors);
  try{
    const data=await resultForPlate(plate,env);
    return json(data,200,cors);
  }catch(e){
    console.error("Lookup failed",String(e));
    return json({error:"לא ניתן להשלים כעת את הבדיקה מול משרד התחבורה"},503,cors);
  }
 },
 async scheduled(controller,env,ctx){ctx.waitUntil(refreshWatched(env));}
};
