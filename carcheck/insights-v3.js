(()=>{
"use strict";
const $=id=>document.getElementById(id);
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const fmt=n=>Number(n).toLocaleString("he-IL");
const HELP={
 "ק״מ בטסט האחרון":"זוהי הקריאה העדכנית שמשרד התחבורה מפרסם. היא אינה רשימה של כל הטסטים הקודמים.",
 "טסט":"מבחן רישוי שנתי. הנתונים עשויים להופיע במאגר עם השהיה.",
 "מקוריות":"סוג השימוש בעת רישומו הראשוני של הרכב, למשל פרטי, השכרה או החכרה.",
 "החכר":"ליסינג — שימוש ברכב דרך חברת החכרה. יש להבדיל בין סוגי החכרה ולבדוק את רישיון הרכב.",
 "החכרה":"ליסינג — רכב שסופק במסגרת חוזה החכרה, למשל ליסינג תפעולי או מימוני.",
 "השכרה":"רכב שהיה רשום לשימוש בחברת השכרת רכבים.",
 "סוחר":"בעלות או רישום אצל סוחר רכב מורשה; לא בהכרח נחשב ליד נוספת ברישיון.",
 "בעלות נוכחית":"סוג הבעלות האחרון המופיע ברישיון או במאגר, אם פורסם.",
 "רמת גימור":"גרסת אבזור ספציפית של הדגם. גרסאות שונות יכולות להיות בעלות מחיר שונה.",
 "נסיגה בקילומטראז׳":"קריאה מאוחרת שנמוכה מקריאה ישנה. זו חריגה לבירור, לא הוכחה לזיוף.",
 "מחיר מבוקש":"מחיר שהתפרסם במודעת מכירה, ולא בהכרח המחיר שבו הרכב נמכר.",
 "מחירון":"הערכת שווי לפי מפרט ומצב. מחירונים מסחריים נפרדים מנתוני מכירות בפועל.",
 "ריקול":"קריאת תיקון של יצרן הרכב למכלול או לבעיה מסוימת.",
 "בעלות פרטית":"רישום כבעלות פרטית, שאינו מאמת לבדו את היסטוריית כל הבעלויות."
};
const wordHelp=term=>{
 if(HELP[term])return HELP[term];
 if(/החכר/.test(term))return HELP["החכר"];
 if(/השכר/.test(term))return HELP["השכרה"];
 if(/סוחר/.test(term))return HELP["סוחר"];
 if(/מקוריות/.test(term))return HELP["מקוריות"];
 if(/טסט/.test(term))return HELP["טסט"];
 if(/ק״מ/.test(term))return HELP["ק״מ בטסט האחרון"];
 return "";
};
const info=term=>'<button type="button" class="ins-info-button" data-help="'+esc(term)+'" aria-label="מה המשמעות של '+esc(term)+'?" title="'+esc(wordHelp(term))+'">i</button>';
const tip=term=>info(term);
const warning=(text,cls="plain")=>'<div class="ins-v3-notice '+cls+'">'+esc(text)+'</div>';
function chart(points,{price=false}={}){
 if(points.length<2)return null;
 const items=points.map(x=>({x:price?Number(x.year):Date.parse(x.date+"T12:00:00"),y:Number(x.value)})).filter(x=>Number.isFinite(x.x)&&Number.isFinite(x.y));
 if(items.length<2)return null;
 const minX=Math.min(...items.map(x=>x.x)),maxX=Math.max(...items.map(x=>x.x));
 if(minX===maxX)return null;
 const low=Math.max(0,Math.min(...items.map(x=>x.y))*.9),high=Math.max(low+1,Math.max(...items.map(x=>x.y))*1.1);
 const W=600,H=210,L=68,R=16,T=12,B=37;
 const xx=n=>L+(n-minX)/(maxX-minX)*(W-L-R);
 const yy=n=>H-B-(n-low)/(high-low)*(H-T-B);
 items.sort((a,b)=>a.x-b.x);
 const grid=Array.from({length:4},(_,i)=>{const value=low+(high-low)*i/3,y=yy(value),x=minX+(maxX-minX)*i/3;
  return '<line x1="'+L+'" x2="'+(W-R)+'" y1="'+y+'" y2="'+y+'" stroke="#e4edf7" />'+
  '<text x="'+(L-8)+'" y="'+(y+4)+'" fill="#6a87a6" text-anchor="end" font-size="11">'+fmt(Math.round(value))+'</text>'+
  '<text x="'+xx(x)+'" y="'+(H-14)+'" fill="#6a87a6" text-anchor="middle" font-size="11">'+(price?Math.round(x):new Date(x).getFullYear())+'</text>';
 }).join("");
 const poly=items.map(i=>xx(i.x)+","+yy(i.y)).join(" ");
 const markers=items.map(i=>'<circle cx="'+xx(i.x)+'" cy="'+yy(i.y)+'" r="5" fill="#1363bd" stroke="#fff" stroke-width="2"><title>'+fmt(i.y)+(price?" ₪":" ק״מ")+"</title></circle>").join("");
 return '<svg viewBox="0 0 '+W+' '+H+'" class="ins-v3-chart" role="img" aria-label="'+(price?"גרף מחירי השוק":"גרף קריאות קילומטראז׳")+'">'+grid+'<polyline points="'+poly+'" fill="none" stroke="#1168c6" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>'+markers+"</svg>";
}
const panel=title=>'<div class="ins-v3-panel"><h3>'+title+"</h3>";
const makeLayout=()=>'<div class="ins-v3-intro"><span>CAR SCOPE / DATA INSIGHTS</span><h2>נתוני הרכב והיסטוריה</h2><p>המידע מוצג לפי רמת האימות שלו. אין שדות להזנה ידנית של קילומטראז׳ או מחירים.</p></div>'+
 '<div class="ins-v3-grid">'+panel('קילומטראז׳ בטסטים '+tip("ק״מ בטסט האחרון"))+'<div id="v3Odo"></div></div>'+
 panel('בעלויות ומקוריות '+tip("מקוריות"))+'<div id="v3Ownership"></div></div></div>'+
 panel('גרף מחירי דגם ומחירון '+tip("מחירון"))+'<div id="v3Prices"></div><div class="ins-blue-footer">מחירונים מסחריים אינם נגישים כרגע ב־API מורשה. <a href="https://www.yad2.co.il/price-list" target="_blank" rel="noopener noreferrer">מחירון יד2</a> · <a href="https://levi-itzhak.co.il/" target="_blank" rel="noopener noreferrer">לוי יצחק</a></div></div>';
const ownerDate=v=>{const t=String(v||"");return /^\d{6}$/.test(t)?t.slice(4,6)+"/"+t.slice(0,4):t};
const fleet=t=>/השכר|החכר|ליסינג|מונית|חברה|תאגיד|בית ספר|נהיגה/i.test(String(t||""));
const nonPrivate=t=>String(t||"").trim()&&!/^(פרטי|פרטית)$/.test(String(t).trim());
let latest=null,mount=null;
function odometer(j){
 let readings=Array.isArray(j.history?.odometerReadings)?j.history.odometerReadings:[];
 if(!readings.length&&Number.isFinite(j.history?.lastMileage)){
  // A single observation is not sufficient to infer a historical trend.
  const t=String(j.vehicle?.lastTestDate||"").slice(0,10);
  readings=[{date:/^\d{4}-\d{2}-\d{2}$/.test(t)?t:null,value:j.history.lastMileage,source:"mot_open_data"}];
 }
 const valid=readings.filter(x=>Number.isFinite(Number(x.value))&&/^\d{4}-\d{2}-\d{2}$/.test(x.date||"")).sort((a,b)=>a.date.localeCompare(b.date));
 const graph=chart(valid);
 let html=graph||'<div class="ins-v3-chart-empty"><span class="ins-v3-empty-symbol">⌁</span><strong>אין מספיק קריאות להצגת מגמה</strong><small>כרגע מוצגת הקריאה האחרונה בלבד. קריאות קודמות יופיעו רק אם נשמרו במסד הנתונים או התקבלו מארכיון מורשה.</small></div>';
 const messages=j.history?.odometerAlerts||[];
 html+=messages.map(f=>warning(f.text,"review")).join("");
 if(!messages.length&&valid.length>=2)html+=warning("לא זוהתה נסיגה בקריאות הזמינות. אין בכך אישור שלא היה שינוי במד האוץ.","good");
 html+=valid.length?'<div class="ins-v3-timeline">'+valid.map(r=>'<div class="ins-v3-reading"><strong>'+fmt(r.value)+' ק״מ</strong><span>'+esc(r.date||"")+'</span><small>'+(r.source==="mot_open_data"?(r.dateType==="first_observed_date"?"קריאה ממשלתית · תאריך תצפית":"משרד התחבורה · טסט"):"מקור ארכיוני")+'</small></div>').join("")+'</div>':"";
 html+='<p class="ins-v3-explain">ה־API הממשלתי מפרסם את הקריאה האחרונה. השירות העצמאי ישמור קריאות לאורך זמן לאחר הפעלת מסד הנתונים.</p>';
 const state=j.backend?.storageStatus;
 if(state==="not_connected"||!state)html+=warning("היסטוריית השרת המרכזי עדיין אינה מחוברת. מוצגים נתוני המקור הממשלתי הנוכחיים בלבד.");
 if(state==="error")html+=warning("השרת ענה, אבל לא ניתן היה לקרוא את ארכיון הקריאות השמור.","review");
 $("v3Odo").innerHTML=html;
}
function ownership(j){
 const items=Array.isArray(j.history?.ownership)?j.history.ownership:[];
 const origin=j.history?.origin||"לא פורסמה";
 const current=j.vehicle?.currentOwnership||"לא פורסמה";
 let html='<div class="ins-v3-ownership-metrics"><div><small>מקוריות '+tip("מקוריות")+'</small><strong>'+esc(origin)+'</strong></div><div><small>בעלות נוכחית '+tip("בעלות נוכחית")+'</small><strong>'+esc(current)+'</strong></div><div><small>רשומות זמינות</small><strong>'+items.length+'</strong></div></div>';
 const non=items.filter(o=>nonPrivate(o.type));
 if(fleet(origin)||fleet(current)||items.some(o=>fleet(o.type)))html+=warning("נמצאה אינדיקציה להשכרה, החכרה, חברה או שימוש מסחרי. יש לאמת ברישיון ובמסמכים.","review");
 else if(non.length||nonPrivate(origin)||nonPrivate(current))html+=warning("זוהה לפחות רישום שאינו פרטי. בדוק את סוג הבעלות והאם הוא נחשב במניין הידיים.","review");
 else if(!items.length)html+=warning("אין די רשומות כדי לקבוע שכל הידיים היו פרטיות.");
 else html+=warning("הרשומות הזמינות מצביעות על בעלויות פרטיות, אך ייתכן שהכיסוי אינו מלא.","good");
 html+=items.length?'<div class="ins-v3-ownerlist">'+items.map(o=>'<div class="ins-v3-owner"><div><strong>'+esc(o.type||"לא ידוע")+'</strong>'+info(o.type||"בעלות נוכחית")+'</div><span>'+esc(ownerDate(o.date)||"אין תאריך")+'</span>'+(nonPrivate(o.type)?'<b class="ins-v3-flag">לא פרטי</b>':"")+'</div>').join("")+'</div>':"";
 html+='<p class="ins-v3-explain">סוחר רכב עשוי להופיע ברצף בלי להוסיף בהכרח יד. אל תסיק ממספר הרשומות את מניין הידיים ברישיון.</p>';
 $("v3Ownership").innerHTML=html;
}
function prices(j){
 const el=$("v3Prices");
 const api=(window.CARSCOPE_API_BASE||"").replace(/\/$/,"");
 const render=rows=>{
  const a=(rows||[]).filter(x=>Number.isFinite(Number(x.asking_price_ils))&&Number.isFinite(Number(x.model_year))&&x.source_name&&x.source_url);
  const g={};a.forEach(r=>(g[r.model_year]??=[]).push(Number(r.asking_price_ils)));
  const p=Object.keys(g).map(y=>{const v=g[y].sort((x,z)=>x-z),m=Math.floor(v.length/2);return {year:Number(y),value:v.length%2?v[m]:(v[m-1]+v[m])/2}});
  const graph=chart(p,{price:true});
  el.innerHTML=graph?graph+
   '<div class="ins-v3-price-info">חציון מחירים מבוקשים ב־'+p.length+' שנתונים, על בסיס '+a.length+' מודעות מתועדות בלבד. אין אלו מחירי סגירת עסקאות.</div>':
   '<div class="ins-v3-chart-empty"><span class="ins-v3-empty-symbol">▤</span><strong>גרף המחירים ממתין לנתוני שוק מאומתים</strong><small>אין עדיין גישה מורשית למחירי דגמים קודמים או למחירון לוי יצחק. לא נציג גרף מחירים מומצא.</small></div>';
 };
 if(!api||!j.vehicle?.manufacturer||!j.vehicle?.model){render([]);return}
 const url=new URL(api+"/api/prices");
 url.searchParams.set("manufacturer",j.vehicle.manufacturer);
 url.searchParams.set("model",j.vehicle.model);
 const plate=j.plate;
 fetch(url.toString()).then(r=>r.ok?r.json():{observations:[]}).then(data=>{if(latest?.plate===plate)render(data.observations)}).catch(()=>render([]));
}
function install(){
 if(mount)return;
 mount=document.createElement("section");
 mount.id="carscope-v3";
 mount.innerHTML=makeLayout();
 $("report").appendChild(mount);
 let pop=document.getElementById("insHelpDialog");
 if(!pop){
  pop=document.createElement("div");pop.id="insHelpDialog";pop.className="ins-help-dialog";pop.setAttribute("role","status");
  pop.hidden=true;document.body.appendChild(pop);
 }
 document.addEventListener("click",e=>{
  const btn=e.target.closest(".ins-info-button");
  if(btn){
   const term=btn.dataset.help;
   pop.innerHTML='<button type="button" id="insHelpClose" aria-label="סגירה">×</button><b>'+esc(term)+'</b><div>'+esc(wordHelp(term)||"מונח המופיע במידע על הרכב. מומלץ לאמת במסמכים הרשמיים.")+"</div>";
   pop.hidden=false;
  }else if(e.target.id==="insHelpClose"||(!pop.contains(e.target)&&!pop.hidden)){pop.hidden=true}
 });
}
function annotateBasicReport(){
 const fields=document.querySelectorAll("#details .detail label, #report .metric label");
 const terms=[
  [/בעלות נוכחית/,"בעלות נוכחית"],
  [/רמת גימור/,"רמת גימור"],
  [/טסט אחרון/,"טסט"],
  [/ק״מ/,"ק״מ בטסט האחרון"]
 ];
 fields.forEach(label=>{
   if(label.querySelector(".ins-info-button"))return;
   const hit=terms.find(([pattern])=>pattern.test(label.textContent||""));
   if(hit)label.insertAdjacentHTML("beforeend",info(hit[1]));
 });
 const owners=document.querySelectorAll("#owners .timeline-item strong");
 owners.forEach(item=>{
   if(item.querySelector(".ins-info-button"))return;
   const found=["החכרה","החכר","השכרה","סוחר"].find(t=>(item.textContent||"").includes(t));
   if(found)item.insertAdjacentHTML("beforeend",info(found));
 });
}
document.addEventListener("carscope:report",e=>{
 if(!e.detail?.plate)return;
 latest=e.detail;
 install();
 odometer(latest);ownership(latest);prices(latest);annotateBasicReport();
});
})();