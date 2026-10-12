export function normalizePlate(raw){
 const text=String(raw??"").replace(/\D/g,"");
 return /^\d{7,8}$/.test(text)?text:null;
}
export function normalizeVehicle(r){
 if(!r)return null;
 return {
  manufacturer:r.tozeret_nm||null,model:r.kinuy_mishari||null,
  trim:r.ramat_gimur||null,year:r.shnat_yitzur||null,
  engineCode:r.degem_manoa||null,fuel:r.sug_delek_nm||null,
  color:r.tzeva_rechev||null,currentOwnership:r.baalut||null,
  lastTestDate:r.mivchan_acharon_dt||null,registrationExpiry:r.tokef_dt||null,
  firstOnRoad:r.moed_aliya_lakvish||null,frontTire:r.zmig_kidmi||null
 };
}
export function asTestDate(raw){
 const s=String(raw||"");
 const value=s.match(/^\d{4}-\d{2}-\d{2}/)?.[0];
 if(!value)return null;
 const parsed=new Date(value+"T00:00:00Z");
 return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0,10)===value?value:null;
}
export function parseOwners(rows){
 return (rows||[]).map(r=>({date:r.baalut_dt==null?null:String(r.baalut_dt),
   type:r.baalut||null})).sort((a,b)=>String(a.date).localeCompare(String(b.date)));
}
export function analyzeMileage(rows){
 const valid=(rows||[]).filter(p=>Number.isFinite(Number(p.value))&&p.date&&
  /^\d{4}-\d{2}-\d{2}$/.test(String(p.date))).map(p=>({...p,value:Number(p.value)}));
 valid.sort((a,b)=>a.date.localeCompare(b.date));
 const alerts=[];
 for(let i=1;i<valid.length;i++){
  const previous=valid[i-1],current=valid[i];
  const days=(Date.parse(current.date)-Date.parse(previous.date))/86400000;
  const diff=current.value-previous.value;
  if(days===0&&current.value!==previous.value)
   alerts.push({severity:"review",code:"CONFLICTING_READINGS",
     text:"קריאות ק״מ סותרות לאותו תאריך. ייתכן תיקון דיווח או שגיאת הקלדה."});
  else if(diff< -100)
   alerts.push({severity:"review",code:"MILEAGE_DECREASE",
     text:"נמצאה ירידה בקריאות הקילומטראז׳. יש לאמת את המקור והמסמכים."});
  else if(days>30&&diff>10000&&(diff/days*365)>80000)
   alerts.push({severity:"review",code:"UNUSUAL_GROWTH",
     text:"נצפה קצב נסועה חריג. ייתכן שימוש אינטנסיבי או שגיאת רישום."});
 }
 return alerts;
}
