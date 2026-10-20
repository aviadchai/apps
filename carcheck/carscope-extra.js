// CarScope extended report: strong warnings, risk signals, model spec, recalls,
// tires/tow, special registries, marketplace search links and a listing checker.
// Renders only what the government sources returned; missing data is labelled as such.
(()=>{
"use strict";
const Core=window.CarScopeCore;
if(!Core)return;
const $=id=>document.getElementById(id);
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const fmt=n=>Number(n).toLocaleString("he-IL");
const stamp=iso=>{const d=new Date(iso);return isNaN(d)?"":d.toLocaleString("he-IL",{day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"})};
const SKIP=new Set(["_id","rank","_full_text"]);
const SOURCE_NAMES={cbs:"ממוצע נסועה שנתי — הלמ״ס"};
let report=null;

function src(key){
 if(SOURCE_NAMES[key])return '<small class="src-tag">מקור: '+esc(SOURCE_NAMES[key])+'</small>';
 const d=report?.datasets?.[key],name=Core.DATASETS[key]?.name||key;
 const link=d?.url?'<a href="'+esc(d.url)+'" target="_blank" rel="noopener">'+esc(name)+'</a>':esc(name);
 return '<small class="src-tag">מקור: '+link+(d?.fetchedAt?" · "+esc(stamp(d.fetchedAt)):"")+'</small>';
}
function shown(key,value){
 if(value===null||value===undefined||String(value).trim()==="")return null;
 if(/_ind$/i.test(key)){
  if(String(value)==="1")return "כן (1)";
  if(String(value)==="0")return "לא (0)";
 }
 return String(value);
}
const cell=(label,value,key,note)=>'<div class="cs-cell"><label>'+esc(label)+'</label><b class="'+(value===null?"cs-na":"")+'">'+esc(value===null?(note||"לא פורסם במאגר"):value)+'</b>'+src(key)+'</div>';
function allFields(records,key){
 if(!records?.length)return "";
 const rows=records.map((r,i)=>'<table class="cs-raw">'+(records.length>1?'<caption>רשומה '+(i+1)+'</caption>':"")+
  Object.keys(r).filter(k=>!SKIP.has(k)).map(k=>'<tr><th>'+esc(Core.FIELD_LABELS[k]||k)+(Core.FIELD_LABELS[k]?' <code>'+esc(k)+'</code>':"")+'</th><td>'+esc(shown(k,r[k])??"—")+'</td></tr>').join("")+'</table>').join("");
 return '<details class="cs-details"><summary>כל השדות שהתקבלו מהמאגר</summary>'+rows+src(key)+'</details>';
}
function statusLine(key,emptyText){
 const d=report?.datasets?.[key];
 if(!d||d.status==="error")return '<div class="cs-note bad">המקור "'+esc(Core.DATASETS[key].name)+'" לא זמין כרגע'+(d?.error?" ("+esc(d.error)+")":"")+'. אין להסיק מכך דבר.</div>'+src(key);
 if(d.status==="skipped")return '<div class="cs-note">'+esc(d.reason||"לא נבדק")+'</div>';
 if(d.status==="empty")return '<div class="cs-note">'+esc(emptyText)+'</div>'+src(key);
 return null;
}
const panel=(title,body,id)=>'<div class="panel cs-panel"'+(id?' id="'+id+'"':"")+'><div class="panel-head"><h3>'+title+'</h3></div><div class="cs-body">'+body+'</div></div>';

function alerts(){
 const ds=report.datasets||{},out=[];
 const cancelled=ds.cancelled?.records||[];
 if(cancelled.length){
  const r=cancelled[0];
  out.push('<div class="cs-alert danger" role="alert"><span class="cs-alert-icon">⛔</span><div><b>הרכב מופיע במאגר כלי הרכב שבוטלו / ירדו מהכביש</b>'+
   'רשומה זו יכולה להעיד על ביטול רישוי סופי, למשל לאחר אובדן גמור. אין לקנות את הרכב לפני בירור מלא במשרד הרישוי.'+
   '<div class="cs-alert-data">'+Core.CANCEL_FIELDS.map(([l,c])=>{const f=Core.pickField(r,c);return f?esc(l)+": <b>"+esc(shown(f.key,f.value)??"לא פורסם")+"</b>":""}).filter(Boolean).join(" · ")+'</div>'+src("cancelled")+'</div></div>');
 }
 if((ds.personalImport?.records||[]).length)
  out.push('<div class="cs-alert caution"><span class="cs-alert-icon">✈</span><div><b>הרכב רשום כיבוא אישי</b>רכב ביבוא אישי לא עבר דרך היבואן הרשמי: כדאי לבדוק זמינות חלקים, אחריות, ריקולים ושירות מוסך מורשה.'+src("personalImport")+'</div></div>');
 if((ds.disabledTag?.records||[]).length)
  out.push('<div class="cs-alert info"><span class="cs-alert-icon">♿</span><div><b>לרכב רשום תו חניה לנכה</b>התו אישי ואינו עובר לקונה. ייתכן שהרכב קיבל הטבות מס שמחייבות בירור.'+src("disabledTag")+'</div></div>');
 $("csAlerts").innerHTML=out.join("");
}

function risks(){
 const list=Core.computeRiskSignals(report);
 const labels={high:"גבוה",medium:"לבירור",info:"מידע"};
 const body=list.length?list.map(s=>'<div class="cs-risk '+s.level+'"><div class="cs-risk-head"><span class="cs-level">'+labels[s.level]+'</span><b>'+esc(s.title)+'</b></div><p>'+esc(s.detail)+'</p><ul>'+
  s.evidence.map(e=>'<li><span>'+esc(e.label)+':</span> <b>'+esc(e.value)+'</b> '+src(e.source)+'</li>').join("")+'</ul></div>').join(""):
  '<div class="cs-note good">לא זוהו אותות סיכון בנתונים שהתקבלו. זה אינו אישור לתקינות הרכב.</div>';
 const failed=["ownership","mileage","recalls","cancelled","registration"].filter(k=>report.datasets?.[k]?.status==="error"||(!report.datasets?.[k]&&report.sources?.[k]==="error"));
 const gaps=failed.length?'<div class="cs-note bad">לא נבדקו אותות התלויים במקורות שלא השיבו: '+failed.map(k=>esc(Core.DATASETS[k].name)).join(", ")+'.</div>':"";
 return panel("אותות סיכון",gaps+body+'<p class="cs-explain">מחושבים אוטומטית רק מהנתונים שלמעלה: החזקה קצרה מ־3 חודשים, ק״מ מתחת ל־50% או מעל 150% מממוצע הלמ״ס ('+fmt(Core.CBS_KM_PER_YEAR)+' ק״מ לשנה), רישום על סוחר, טסט שפג או יפוג בתוך 60 יום, ריקולים פתוחים ורשומת ביטול.</p>',"csRisks");
}

function spec(){
 const d=report.datasets?.spec;
 const st=statusLine("spec","לא נמצאה רשומת מפרט התואמת ליצרן, לדגם ולשנה של הרכב.");
 if(st)return panel("מפרט הדגם",st);
 const recs=d.records;
 let note="";
 if(d.trimMatched===false)note='<div class="cs-note">לא נמצאה התאמה לרמת הגימור הרשומה; מוצגות כל הגרסאות של הדגם והשנה.</div>';
 if(recs.length>1)note+='<div class="cs-note">נמצאו '+recs.length+' גרסאות תואמות. ערך שאינו זהה בכולן מוצג עם כל האפשרויות.</div>';
 const cells=Core.SPEC_FIELDS.map(([label,cands])=>{
  const vals=recs.map(r=>Core.pickField(r,cands)).filter(Boolean);
  if(!vals.length)return cell(label,null,"spec","השדה אינו קיים במאגר");
  const uniq=[...new Set(vals.map(f=>shown(f.key,f.value)).filter(x=>x!==null))];
  return cell(label,uniq.length?uniq.join(" / "):null,"spec");
 }).join("");
 const join=Object.entries(d.filters||{}).map(([k,v])=>k+"="+v).join(", ");
 return panel("מפרט הדגם",note+'<div class="cs-grid">'+cells+'</div><p class="cs-explain">חיבור למאגר המפרט לפי '+esc(join)+(d.trimMatched?" ורמת הגימור":"")+'.</p>'+allFields(recs,"spec"));
}

function recalls(){
 const st=statusLine("recalls","לא נמצאו ריקולים פתוחים לרכב זה במאגר.");
 if(st)return panel("ריקולים פתוחים",st);
 const recs=report.datasets.recalls.records;
 return panel("ריקולים פתוחים ("+recs.length+")",recs.map(r=>'<div class="cs-recall"><div class="cs-grid">'+
  Core.RECALL_FIELDS.map(([l,c])=>{const f=Core.pickField(r,c);return f?cell(l,shown(f.key,f.value),"recalls"):""}).join("")+'</div></div>').join("")+allFields(recs,"recalls"));
}

function tires(){
 const st=statusLine("tires","לא נמצאה רשומה במאגר הצמיגים והגרירה.");
 if(st)return panel("צמיגים ווו גרירה",st);
 const r=report.datasets.tires.records[0];
 return panel("צמיגים ווו גרירה",'<div class="cs-grid">'+Core.TIRE_FIELDS.map(([l,c])=>{const f=Core.pickField(r,c);return cell(l,f?shown(f.key,f.value):null,"tires",f?undefined:"השדה אינו קיים במאגר")}).join("")+'</div>'+allFields(report.datasets.tires.records,"tires"));
}

function registries(){
 const rows=[["cancelled","לא מופיע במאגר הרכבים שבוטלו"],["personalImport","לא מופיע במאגר היבוא האישי"],["disabledTag","לא מופיע במאגר תווי הנכה"]].map(([k,emptyText])=>{
  const d=report.datasets?.[k];
  const state=!d||d.status==="error"?'<span class="bad">המקור לא זמין — לא נבדק</span>':d.status==="found"?'<span class="bad">נמצאה רשומה</span>':'<span class="ok">'+emptyText+'</span>';
  return '<div class="cs-reg"><b>'+esc(Core.DATASETS[k].name)+'</b>'+state+src(k)+(d?.status==="found"?allFields(d.records,k):"")+'</div>';
 }).join("");
 return panel("מאגרים מיוחדים",rows);
}

function market(){
 const links=Core.marketLinks(report.vehicle);
 const linkHtml=links.length?'<div class="cs-links">'+links.map(l=>'<a href="'+esc(l.url)+'" target="_blank" rel="noopener noreferrer">'+esc(l.label)+' ↗</a>').join("")+'</div><p class="cs-explain">החיפוש: "'+esc(links[0].query)+'". הקישורים פותחים את האתרים עצמם; CarScope אינו אוסף מהם נתונים. ביד2 ייתכן שיהיה צורך לבחור יצרן ודגם בסינון.</p>':
  '<div class="cs-note">אין יצרן ודגם מהמאגר לבניית חיפוש.</div>';
 const box='<label class="cs-label" for="csListing">הדבק טקסט של מודעה (יד2, פייסבוק וכו׳)</label>'+
  '<textarea id="csListing" rows="5" placeholder="לדוגמה: יד 2, 45,000 ק״מ, 62,000 ₪, מיקום: חיפה"></textarea>'+
  '<button type="button" class="ghostbtn" id="csCheckListing">השווה לנתוני משרד התחבורה</button><div id="csListingResult" aria-live="polite"></div>'+
  '<p class="cs-explain">הטקסט מעובד רק בדפדפן שלך ואינו נשלח לשום שרת.</p>';
 return panel("מודעות ומחירים",linkHtml+box,"csMarket");
}

function checkListing(){
 const text=$("csListing").value;
 const out=$("csListingResult");
 if(!text.trim()){out.innerHTML='<div class="cs-note">יש להדביק טקסט של מודעה.</div>';return}
 const l=Core.parseListing(text);
 const names={price:"מחיר",km:"ק״מ",hand:"יד",year:"שנה",location:"מיקום"};
 const val=(k,v)=>v===null?"לא זוהה":k==="price"?fmt(v)+" ₪":k==="km"?fmt(v)+" ק״מ":String(v);
 const parsed='<div class="cs-grid">'+Object.keys(names).map(k=>'<div class="cs-cell"><label>'+names[k]+' (מהמודעה)</label><b class="'+(l[k]===null?"cs-na":"")+'">'+esc(val(k,l[k]))+'</b>'+(l.found[k]?'<small class="src-tag">זוהה מתוך: "'+esc(l.found[k])+'"</small>':"")+'</div>').join("")+'</div>';
 const cmp=Core.compareListing(l,report);
 const cls={high:"bad",info:"",ok:"good"};
 const srcFor={km:"mileage",hand:"ownership",year:"registration"};
 out.innerHTML=parsed+(cmp.length?cmp.map(c=>'<div class="cs-note '+cls[c.level]+'">'+(c.level==="high"?"⚠ אי־התאמה: ":"")+esc(c.text)+src(srcFor[c.field])+'</div>').join(""):'<div class="cs-note">לא זוהו במודעה ק״מ, יד או שנה להשוואה.</div>')+
  (l.price!==null?'<p class="cs-explain">המחיר מוצג כפי שהוא במודעה. אין ל־CarScope מחירון מורשה להשוואה.</p>':"");
}

document.addEventListener("carscope:report",e=>{
 report=e.detail;
 if(!report)return;
 alerts();
 $("csExtra").innerHTML=risks()+spec()+recalls()+tires()+registries()+market();
 $("csCheckListing").addEventListener("click",checkListing);
});
})();
