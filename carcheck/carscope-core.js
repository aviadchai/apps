// CarScope core: dataset registry, parallel government lookups, risk signals and
// listing comparison. Pure logic, shared by the browser (window.CarScopeCore) and
// Node tests (require). No value here is ever estimated and presented as a fact.
(function(root,factory){
 const api=factory();
 if(typeof module==="object"&&module.exports)module.exports=api;
 else root.CarScopeCore=api;
})(typeof self!=="undefined"?self:this,function(){
"use strict";
const ENDPOINT="https://data.gov.il/api/3/action/datastore_search";
// Average annual distance for private cars in Israel (CBS / הלמ״ס).
const CBS_KM_PER_YEAR=14700;
// plateField: the filter column when known. null means: read the schema first.
const DATASETS={
 registration:{id:"053cea08-09bc-40ec-8f7a-156f0677aff3",name:"מאגר רישוי ומפרט",plateField:"mispar_rechev",limit:3},
 mileage:{id:"56063a99-8a3e-4ff4-912e-5966c0279bad",name:"מאגר ק״מ בטסט האחרון",plateField:"mispar_rechev",limit:3},
 ownership:{id:"bb2355dc-9ec7-4f06-9c3f-3344672171da",name:"מאגר היסטוריית בעלויות",plateField:"mispar_rechev",limit:150},
 recalls:{id:"36bf1404-0be4-49d2-82dc-2f1ead4a8b93",name:"ריקולים פתוחים לרכב",plateField:"MISPAR_RECHEV",limit:50},
 tires:{id:"0866573c-40cd-4ca8-91d2-9dd2d7a492e5",name:"צמיגים וגרירה",plateField:"mispar_rechev",limit:3},
 cancelled:{id:"851ecab1-0622-4dbe-a6c7-f950cf82abf9",name:"כלי רכב שבוטלו / ירדו מהכביש",plateField:"mispar_rechev",limit:3},
 disabledTag:{id:"c8b9f9c8-4612-4068-934f-d4acd2e3c06e",name:"תו חניה לנכה",plateField:null,limit:3},
 personalImport:{id:"03adc637-b6fe-402b-9937-7c3d3afc9140",name:"רכבים ביבוא אישי",plateField:null,limit:3},
 spec:{id:"142afde2-6228-49f9-8a29-9b6c3a0cbe40",name:"מפרט דגמי רכב",join:["tozeret_cd","degem_cd","shnat_yitzur"],limit:30}
};
const PLATE_KINDS=Object.keys(DATASETS).filter(k=>!DATASETS[k].join);

// Field groups shown in the report. Candidates are tried in order; a group whose
// keys are absent from the record is shown as "not published", never guessed.
const SPEC_FIELDS=[
 ["כוח סוס",["koah_sus"]],["נפח מנוע (סמ״ק)",["nefah_manoa","nefach_manoa"]],
 ["הנעה",["hanaa_nm","technologiat_hanaa_nm"]],["כריות אוויר",["mispar_kariot_avir"]],
 ["ABS",["abs_ind"]],["בקרת יציבות",["bakarat_yatzivut_ind"]],
 ["ארץ ייצור",["tozeret_eretz_nm"]],["תיבת הילוכים אוטומטית",["automatic_ind"]],
 ["מספר מושבים",["mispar_moshavim"]],["מספר דלתות",["mispar_dlatot"]],
 ["משקל כולל (ק״ג)",["mishkal_kolel"]],["רמת אבזור בטיחותי",["ramat_eivzur_betihuty"]],
 ["קבוצת זיהום",["kvutzat_zihum"]],["כושר גרירה עם בלמים",["kosher_grira_im_blamim"]],
 ["כושר גרירה בלי בלמים",["kosher_grira_bli_blamim"]]
];
const TIRE_FIELDS=[
 ["צמיג קדמי",["zmig_kidmi"]],["צמיג אחורי",["zmig_ahori"]],
 ["קוד עומס צמיג קדמי",["kod_omes_tzmig_kidmi","kod_omes_zmig_kidmi"]],
 ["קוד עומס צמיג אחורי",["kod_omes_tzmig_ahori","kod_omes_zmig_ahori"]],
 ["קוד מהירות צמיג קדמי",["kod_mehirut_tzmig_kidmi","kod_mehirut_zmig_kidmi"]],
 ["קוד מהירות צמיג אחורי",["kod_mehirut_tzmig_ahori","kod_mehirut_zmig_ahori"]],
 ["וו גרירה",["grira_nm"]]
];
const RECALL_FIELDS=[
 ["מזהה ריקול",["RECALL_ID"]],["סוג ריקול",["SUG_RECALL"]],["סוג תקלה",["SUG_TAKALA"]],
 ["תיאור התקלה",["TEUR_TAKALA"]],["אופן התיקון",["OFEN_TIKUN"]],["תאריך פתיחה",["TAARICH_PTICHA"]],
 ["יבואן",["YEVUAN_TEUR"]],["טלפון",["TELEPHONE"]],["אתר",["WEBSITE"]]
];
const CANCEL_FIELDS=[["תאריך ביטול",["bitul_dt"]],["סטטוס ביטול",["bitul_nm"]],["קוד ביטול",["bitul_cd"]]];
const FIELD_LABELS={
 mispar_rechev:"מספר רכב",MISPAR_RECHEV:"מספר רכב",tozeret_cd:"קוד יצרן",tozeret_nm:"יצרן",
 tozeret_eretz_nm:"ארץ ייצור",degem_cd:"קוד דגם",degem_nm:"שם דגם",kinuy_mishari:"כינוי מסחרי",
 ramat_gimur:"רמת גימור",shnat_yitzur:"שנת ייצור",sug_degem:"סוג דגם",tzeva_rechev:"צבע",
 sug_delek_nm:"סוג דלק",moed_aliya_lakvish:"עלייה לכביש",bitul_dt:"תאריך ביטול",bitul_nm:"סטטוס ביטול",
 bitul_cd:"קוד ביטול",grira_nm:"וו גרירה",zmig_kidmi:"צמיג קדמי",zmig_ahori:"צמיג אחורי"
};

const empty=v=>v===null||v===undefined||String(v).trim()==="";
function pickField(record,candidates){
 if(!record)return null;
 for(const key of candidates)if(Object.prototype.hasOwnProperty.call(record,key))
  return {key,value:empty(record[key])?null:record[key]};
 return null;
}
const normKey=s=>String(s||"").toLowerCase().replace(/[\s-]+/g,"_");
function findPlateField(fields){
 const f=(fields||[]).find(x=>normKey(x.id)==="mispar_rechev");
 return f?f.id:null;
}
function plateValue(plate,field){
 const type=String(field?.type||"").toLowerCase();
 return /^(text|varchar|char|string)/.test(type)?String(plate):Number(plate);
}
function govUrl(params){
 const u=new URL(ENDPOINT);
 u.searchParams.set("resource_id",params.resource_id);
 if(params.filters)u.searchParams.set("filters",JSON.stringify(params.filters));
 u.searchParams.set("limit",String(params.limit??10));
 return u.toString();
}
function validateGov(json){
 if(!json||json.success!==true||!Array.isArray(json.result?.records))throw new Error("מאגר הממשלה החזיר תשובה שאינה תקינה.");
 return {records:json.result.records,fields:Array.isArray(json.result.fields)?json.result.fields:[],total:json.result.total};
}

// query(params) -> {records,fields}; supplied by the caller (fetch / JSONP / test fake).
async function queryByPlate(query,ds,plate){
 let field=ds.plateField,schema=null;
 const run=(f,value)=>query({resource_id:ds.id,filters:{[f]:value},limit:ds.limit}).then(r=>({...r,plateField:f,url:govUrl({resource_id:ds.id,filters:{[f]:value},limit:ds.limit})}));
 if(!field){
  schema=(await query({resource_id:ds.id,limit:0})).fields;
  field=findPlateField(schema);
  if(!field)throw new Error("לא נמצא שדה מספר רכב במבנה המאגר");
  return run(field,plateValue(plate,schema.find(f=>f.id===field)));
 }
 try{return await run(field,Number(plate))}
 catch(err){
  // The documented filter column or its type may differ: read the real schema and retry once.
  schema=(await query({resource_id:ds.id,limit:0})).fields;
  const alt=findPlateField(schema);
  if(!alt)throw err;
  const value=plateValue(plate,schema.find(f=>f.id===alt));
  if(alt===field&&typeof value==="number")throw err;
  return run(alt,value);
 }
}
const normText=s=>String(s??"").replace(/\s+/g," ").trim().toLowerCase();
async function querySpec(query,reg){
 const ds=DATASETS.spec;
 if(!reg)return {status:"skipped",reason:"אין רשומת רישוי לחיבור למפרט",records:[]};
 const filters={};
 for(const k of ds.join){
  if(empty(reg[k]))return {status:"skipped",reason:"ברשומת הרישוי חסר השדה "+k,records:[]};
  filters[k]=reg[k];
 }
 const r=await query({resource_id:ds.id,filters,limit:ds.limit});
 let records=r.records,trimMatched=null;
 if(!empty(reg.ramat_gimur)&&records.some(x=>"ramat_gimur" in x)){
  const same=records.filter(x=>normText(x.ramat_gimur)===normText(reg.ramat_gimur));
  trimMatched=same.length>0;
  if(same.length)records=same;
 }
 return {status:records.length?"found":"empty",records,trimMatched,filters,url:govUrl({resource_id:ds.id,filters,limit:ds.limit})};
}

// Runs every plate dataset in parallel; the spec join starts as soon as the
// registration record arrives. A failing source never fails the whole lookup.
async function lookupPlate(plate,{query,kinds=Object.keys(DATASETS),now=()=>new Date()}){
 const datasets={};
 const one=async key=>{
  const ds=DATASETS[key];
  try{
   const r=await queryByPlate(query,ds,plate);
   datasets[key]={status:r.records.length?"found":"empty",records:r.records,url:r.url,fetchedAt:now().toISOString()};
  }catch(e){
   datasets[key]={status:"error",records:[],error:String(e?.message||e),fetchedAt:now().toISOString()};
  }
 };
 const jobs=kinds.filter(k=>DATASETS[k]&&!DATASETS[k].join).map(k=>[k,one(k)]);
 const regJob=jobs.find(([k])=>k==="registration");
 const spec=(regJob?regJob[1]:Promise.resolve()).then(async()=>{
  if(!kinds.includes("spec"))return;
  try{
   const r=await querySpec(query,datasets.registration?.records?.[0]);
   datasets.spec={...r,fetchedAt:now().toISOString()};
  }catch(e){datasets.spec={status:"error",records:[],error:String(e?.message||e),fetchedAt:now().toISOString()}}
 });
 await Promise.all([...jobs.map(j=>j[1]),spec]);
 return datasets;
}

// ---- dates ----
function parseGovDate(raw){
 if(empty(raw))return null;
 const s=String(raw).trim();
 let m;
 if((m=s.match(/^(\d{4})-(\d{2})-(\d{2})/)))return new Date(Date.UTC(+m[1],+m[2]-1,+m[3]));
 if((m=s.match(/^(\d{4})(\d{2})$/)))return new Date(Date.UTC(+m[1],+m[2]-1,1));
 if((m=s.match(/^(\d{4})-(\d{1,2})$/)))return new Date(Date.UTC(+m[1],+m[2]-1,1));
 return null;
}
const monthIndex=d=>d.getUTCFullYear()*12+d.getUTCMonth();
const DAY=86400000;
const fmtNum=n=>Number(n).toLocaleString("en-US");
const ymd=d=>d.toISOString().slice(0,10);

// ---- risk signals ----
// Each signal: {id, level: high|medium|info, title, detail, evidence:[{label,value,source}]}
function computeRiskSignals(report,now=new Date()){
 const out=[];
 const v=report.vehicle||{},h=report.history||{},ds=report.datasets||{};
 const owners=(h.ownership||[]).filter(o=>parseGovDate(o.date)).slice().sort((a,b)=>String(a.date).localeCompare(String(b.date)));
 for(let i=1;i<owners.length;i++){
  const a=parseGovDate(owners[i-1].date),b=parseGovDate(owners[i].date);
  const months=monthIndex(b)-monthIndex(a);
  if(months<3)out.push({id:"rapid_ownership",level:"medium",
   title:"החלפת בעלות מהירה",
   detail:"בעלות שהוחזקה "+(months<=0?"פחות מחודש":months+" חודשים")+" בלבד (לפי חודשי הרישום במאגר). אצל סוחר זה נפוץ, אך כדאי לברר.",
   evidence:[{label:"רשומה "+i,value:owners[i-1].date+" · "+(owners[i-1].type||"לא ידוע"),source:"ownership"},
    {label:"רשומה "+(i+1),value:owners[i].date+" · "+(owners[i].type||"לא ידוע"),source:"ownership"}]});
 }
 const km=Number.isFinite(h.lastMileage)?h.lastMileage:null;
 const testDate=parseGovDate(v.lastTestDate);
 const start=parseGovDate(v.firstOnRoad)||parseGovDate(h.firstRegistration);
 if(km!==null&&testDate&&start){
  const years=(testDate-start)/(365.25*DAY);
  if(years>=1){
   const expected=years*CBS_KM_PER_YEAR,ratio=km/expected;
   const ev=[{label:"ק״מ בטסט האחרון",value:fmtNum(km),source:"mileage"},
    {label:"תאריך הטסט האחרון",value:String(v.lastTestDate),source:"registration"},
    {label:"עלייה לכביש",value:String(v.firstOnRoad||h.firstRegistration),source:v.firstOnRoad?"registration":"mileage"},
    {label:"חישוב",value:years.toFixed(1)+" שנים × "+fmtNum(CBS_KM_PER_YEAR)+" = "+fmtNum(Math.round(expected))+" ק״מ (ממוצע הלמ״ס)",source:"cbs"},
    {label:"יחס לממוצע",value:Math.round(ratio*100)+"%",source:"cbs"}];
   if(ratio<0.5)out.push({id:"odometer_low",level:"medium",title:"קילומטראז׳ נמוך בהרבה מהממוצע",
    detail:"הקריאה נמוכה מחצי מהממוצע לגיל הרכב. ייתכן שימוש מועט, אך כדאי לאמת מול ספר טיפולים ומסמכים.",evidence:ev});
   else if(ratio>1.5)out.push({id:"odometer_high",level:"medium",title:"קילומטראז׳ גבוה בהרבה מהממוצע",
    detail:"הקריאה גבוהה מפי 1.5 מהממוצע לגיל הרכב. ייתכן שימוש אינטנסיבי (מונית, ליסינג, נסיעות ארוכות).",evidence:ev});
  }
 }
 const lastOwner=owners.length?owners[owners.length-1]:null;
 const dealer=t=>/סוחר/.test(String(t||""));
 if(dealer(v.currentOwnership)||dealer(lastOwner?.type)){
  const ev=[];
  if(dealer(v.currentOwnership))ev.push({label:"בעלות נוכחית ברישוי",value:String(v.currentOwnership),source:"registration"});
  if(dealer(lastOwner?.type))ev.push({label:"רשומת הבעלות האחרונה",value:lastOwner.date+" · "+lastOwner.type,source:"ownership"});
  out.push({id:"dealer_owned",level:"medium",title:"הרכב רשום כרגע על סוחר",
   detail:"המוכר הוא כנראה סוחר ולא הבעלים הקודם. בקשו את פרטי הבעלים שלפני הסוחר ואת היסטוריית הטיפולים.",evidence:ev});
 }
 const expiry=parseGovDate(v.registrationExpiry);
 if(expiry){
  const days=Math.floor((expiry-Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate()))/DAY);
  if(days<0)out.push({id:"test_expired",level:"high",title:"תוקף הרישיון (טסט) פג",
   detail:"לפי המאגר, תוקף הרישוי פג לפני "+(-days)+" ימים.",evidence:[{label:"תוקף רישוי",value:String(v.registrationExpiry),source:"registration"}]});
  else if(days<=60)out.push({id:"test_expiring",level:"medium",title:"הטסט פג בקרוב",
   detail:"נותרו "+days+" ימים לתוקף הרישוי. כדאי לסכם מי מבצע ומשלם על הטסט.",evidence:[{label:"תוקף רישוי",value:String(v.registrationExpiry),source:"registration"}]});
 }
 const recalls=ds.recalls?.records||[];
 if(recalls.length)out.push({id:"open_recalls",level:"high",title:recalls.length===1?"ריקול פתוח":recalls.length+" ריקולים פתוחים",
  detail:"הרכב מופיע במאגר הריקולים שלא בוצעו. יש לבדוק מול היבואן שהתיקון בוצע.",
  evidence:recalls.map(r=>({label:"ריקול "+(r.RECALL_ID??""),value:[r.TEUR_TAKALA||r.SUG_TAKALA,r.TAARICH_PTICHA].filter(x=>!empty(x)).join(" · ")||"פרטים במאגר",source:"recalls"}))});
 const cancelled=ds.cancelled?.records||[];
 if(cancelled.length)out.push({id:"cancelled",level:"high",title:"הרכב מופיע במאגר כלי רכב שבוטלו",
  detail:"רשומה במאגר הביטול הסופי (למשל אובדן גמור או הורדה מהכביש). אין לקנות לפני בירור מלא במשרד הרישוי.",
  evidence:cancelled.map(r=>({label:"רשומת ביטול",value:[r.bitul_dt,r.bitul_nm].filter(x=>!empty(x)).join(" · ")||"נמצאה רשומה",source:"cancelled"}))});
 const order={high:0,medium:1,info:2};
 return out.sort((a,b)=>order[a.level]-order[b.level]);
}

// ---- listing parser ----
const HAND_WORDS={"ראשונה":1,"שנייה":2,"שניה":2,"שלישית":3,"רביעית":4,"חמישית":5,"שישית":6};
function toNumber(raw,thousands){
 let s=String(raw).trim().replace(/\s/g,"");
 if(/^\d{1,3}([.,]\d{3})+$/.test(s))s=s.replace(/[.,]/g,"");
 else s=s.replace(/,/g,"");
 let n=Number(s);
 if(!Number.isFinite(n))return null;
 if(thousands)n*=1000;
 return Math.round(n);
}
const NUM="(\\d{1,3}(?:[.,]\\d{3})+|\\d+(?:\\.\\d+)?)";
const K="\\s*(אלף|k)?";
function parseListing(text){
 const t=String(text||"").replace(/[״“”]/g,'"').replace(/[׳‘’]/g,"'");
 const out={price:null,km:null,hand:null,year:null,location:null,found:{}};
 const take=(key,value,snippet)=>{if(value!==null&&out[key]===null){out[key]=value;out.found[key]=snippet.trim()}};
 const KM_UNIT='(?:ק"מ|ק\'מ|קמ|קילומטר(?:ים)?|km)';
 let m;
 if((m=t.match(new RegExp(NUM+K+"\\s*"+KM_UNIT,"i"))))take("km",toNumber(m[1],m[2]),m[0]);
 if((m=t.match(new RegExp("(?:קילומטראז'?|קילומטרז'?|נסועה|mileage)\\s*[:\\-]?\\s*"+NUM+K,"i"))))take("km",toNumber(m[1],m[2]),m[0]);
 if((m=t.match(new RegExp("(?:₪|ש\"ח|nis|ils)\\s*"+NUM+K,"i"))))take("price",toNumber(m[1],m[2]),m[0]);
 if((m=t.match(new RegExp(NUM+K+"\\s*(?:₪|ש\"ח|שקל(?:ים)?|nis|ils)","i"))))take("price",toNumber(m[1],m[2]),m[0]);
 if((m=t.match(new RegExp("(?:מחיר|price)\\s*[:\\-]?\\s*"+NUM+K,"i"))))take("price",toNumber(m[1],m[2]),m[0]);
 if((m=t.match(/יד\s*[:\-]?\s*(\d{1,2})(?!\d)/)))take("hand",Number(m[1]),m[0]);
 if((m=t.match(/יד\s+(ראשונה|שנייה|שניה|שלישית|רביעית|חמישית|שישית)/)))take("hand",HAND_WORDS[m[1]],m[0]);
 if((m=t.match(/\bhand\s*[:\-]?\s*(\d{1,2})\b/i)))take("hand",Number(m[1]),m[0]);
 if((m=t.match(/(?:שנת(?:\s*ייצור|\s*עלייה\s*לכביש)?|שנה|מודל|year)\s*[:\-]?\s*((?:19|20)\d{2})/i)))take("year",Number(m[1]),m[0]);
 if((m=t.match(/(?:מיקום|אזור|עיר|יישוב|ישוב|location)\s*[:\-]\s*([^\n,|•·]{2,40})/i)))take("location",m[1].trim(),m[0]);
 return out;
}

// Compares a parsed listing with the government report. Never treats a gap as proof.
function compareListing(listing,report){
 const res=[];
 const h=report.history||{},v=report.vehicle||{};
 const km=Number.isFinite(h.lastMileage)?h.lastMileage:null;
 if(listing.km!==null){
  if(km===null)res.push({field:"km",level:"info",text:"אין קריאת ק״מ ממשלתית להשוואה.",stated:listing.km,gov:null});
  else if(listing.km<km)res.push({field:"km",level:"high",text:"הק״מ במודעה ("+fmtNum(listing.km)+") נמוך מהק״מ שנרשם בטסט האחרון ("+fmtNum(km)+"). מד מרחק לא אמור לרדת — יש לברר.",stated:listing.km,gov:km});
  else res.push({field:"km",level:"ok",text:"הק״מ במודעה ("+fmtNum(listing.km)+") גבוה או שווה לקריאת הטסט האחרון ("+fmtNum(km)+"), תוספת של "+fmtNum(listing.km-km)+" ק״מ.",stated:listing.km,gov:km});
 }
 if(listing.hand!==null){
  const owners=h.ownership||[];
  const nonDealer=owners.filter(o=>!/סוחר/.test(String(o.type||""))).length;
  if(!owners.length)res.push({field:"hand",level:"info",text:"אין רשומות בעלות במאגר להשוואה ליד המוצהרת.",stated:listing.hand,gov:null});
  else if(listing.hand<nonDealer)res.push({field:"hand",level:"high",text:"במודעה כתוב יד "+listing.hand+", אך במאגר יש "+nonDealer+" רשומות בעלות שאינן סוחר (מתוך "+owners.length+"). כדאי לבקש את רישיון הרכב.",stated:listing.hand,gov:nonDealer});
  else if(listing.hand>owners.length)res.push({field:"hand",level:"info",text:"במודעה יד "+listing.hand+", ובמאגר רק "+owners.length+" רשומות בעלות. ייתכן שהמאגר אינו מכסה את כל ההיסטוריה.",stated:listing.hand,gov:owners.length});
  else res.push({field:"hand",level:"ok",text:"יד "+listing.hand+" מתיישבת עם "+owners.length+" רשומות הבעלות במאגר ("+nonDealer+" שאינן סוחר).",stated:listing.hand,gov:nonDealer});
 }
 if(listing.year!==null&&!empty(v.year)){
  if(Number(v.year)!==listing.year)res.push({field:"year",level:"high",text:"שנת הרכב במודעה ("+listing.year+") שונה משנת הייצור במאגר ("+v.year+"). ייתכן שהמודעה מציינת שנת עלייה לכביש — לברר.",stated:listing.year,gov:Number(v.year)});
  else res.push({field:"year",level:"ok",text:"שנת הרכב תואמת למאגר ("+v.year+").",stated:listing.year,gov:Number(v.year)});
 }
 return res;
}

// ---- marketplace deep links (no scraping, search pages only) ----
const COUNTRY_SUFFIX=/\s+(סין|יפן|קוריאה|קוריאה דרום|גרמניה|צרפת|ספרד|צ'כיה|צ׳כיה|איטליה|ארה"ב|ארה״ב|אנגליה|בריטניה|הודו|טורקיה|תאילנד|מקסיקו|רומניה|סלובקיה|הונגריה|שוודיה|בלגיה|פולין|אוסטריה|ברזיל|דרא"פ|הולנד|פורטוגל|קנדה|מרוקו|סלובניה|טייוואן|אינדונזיה|מלזיה|ארגנטינה|אוסטרליה|יוון)$/;
function cleanMake(name){
 let s=String(name||"").trim();
 for(let i=0;i<2;i++)s=s.replace(COUNTRY_SUFFIX,"").trim();
 return s;
}
function marketLinks(v){
 if(!v||empty(v.model))return [];
 const make=cleanMake(v.manufacturer),model=String(v.model).trim(),year=empty(v.year)?"":String(v.year);
 const q=[make,model,year].filter(Boolean).join(" ");
 const links=[
  {id:"yad2",label:"חיפוש ביד2",url:"https://www.yad2.co.il/vehicles/cars?"+(year?"year="+year+"-"+year+"&":"")+"text="+encodeURIComponent([make,model].filter(Boolean).join(" ")),query:q},
  // Yad2 filters by numeric manufacturer IDs we do not have; this site search is the fallback.
  {id:"yad2_web",label:"יד2 דרך חיפוש Google",url:"https://www.google.com/search?q="+encodeURIComponent("site:yad2.co.il/vehicles "+q),query:q},
  {id:"facebook",label:"חיפוש ב-Facebook Marketplace",url:"https://www.facebook.com/marketplace/category/vehicles?query="+encodeURIComponent(q)+(year?"&minYear="+year+"&maxYear="+year:"")+"&exact=false",query:q},
  {id:"levi",label:"מחירון לוי יצחק (באתר שלהם)",url:"https://www.levi-itzhak.co.il/",query:q}
 ];
 return links;
}

return {ENDPOINT,CBS_KM_PER_YEAR,DATASETS,PLATE_KINDS,SPEC_FIELDS,TIRE_FIELDS,RECALL_FIELDS,CANCEL_FIELDS,FIELD_LABELS,
 pickField,findPlateField,plateValue,govUrl,validateGov,queryByPlate,querySpec,lookupPlate,
 parseGovDate,computeRiskSignals,parseListing,compareListing,cleanMake,marketLinks};
});
