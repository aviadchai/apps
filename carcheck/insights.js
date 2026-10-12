(function(){
"use strict";
var root=null,report=null;
function el(id){return document.getElementById(id)}
function safe(v){return String(v==null?"":v).replace(/[&<>"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]})}
function number(n){return Number(n).toLocaleString("he-IL")}
function key(kind){return "carscope-insights:"+kind+":"+(kind==="prices"?String(report.vehicle?.manufacturer||"")+"|"+String(report.vehicle?.model||""):report.plate)}
function load(kind){try{var v=JSON.parse(localStorage.getItem(key(kind)));return Array.isArray(v)?v:[]}catch(e){return []}}
function save(kind,rows){try{localStorage.setItem(key(kind),JSON.stringify(rows))}catch(e){alert("לא ניתן לשמור נתונים בדפדפן זה.")}}
function today(){return new Date().toISOString().slice(0,10)}
function dateValue(s){var t=String(s||"");if(/^\d{4}-\d{2}-\d{2}/.test(t))return t.slice(0,10);if(/^\d{6}$/.test(t))return t.slice(0,4)+"-"+t.slice(4,6)+"-01";return null}
function validDate(s){return /^\d{4}-\d{2}-\d{2}$/.test(s)&&!isNaN(Date.parse(s))&&s<=today()}
function isNotPrivate(v){var t=String(v||"").trim();return t&&!/^(פרטי|פרטית)$/.test(t)}
function isFleet(v){return /השכר|החכר|ליסינג|חברה|תאגיד|מונית|ממשלת|נהיגה/i.test(String(v||""))}
function notice(t,cls){return '<div class="ins-notice '+(cls||"")+'">'+safe(t)+'</div>'}
function chart(points,prices){
 if(points.length<2)return notice(prices?"הוסף לפחות שתי נקודות מחיר משנתונים שונים להצגת הגרף.":"לגרף היסטוריית ק״מ דרושות שתי קריאות מתאריכים שונים.");
 var entries=points.map(function(x){return {x:prices?Number(x.year):Date.parse(x.date+"T12:00:00"),y:Number(x.value)}});
 var minX=Math.min.apply(null,entries.map(x=>x.x)),maxX=Math.max.apply(null,entries.map(x=>x.x));
 if(minX===maxX)return notice(prices?"יש להזין נתונים משני שנתונים שונים.":"קריאות באותו תאריך אינן יוצרות רצף.");
 var minY=Math.min.apply(null,entries.map(x=>x.y)),maxY=Math.max.apply(null,entries.map(x=>x.y));
 minY=Math.max(0,minY*.89);maxY=Math.max(maxY*1.1,minY+1);
 var W=640,H=230,L=72,R=20,T=16,B=43;
 var X=x=>L+(x-minX)/(maxX-minX)*(W-L-R),Y=y=>H-B-(y-minY)/(maxY-minY)*(H-B-T);
 entries.sort((a,b)=>a.x-b.x);
 var lines="",labels="",dots="";
 for(var i=0;i<4;i++){var p=i/3,v=minY+(maxY-minY)*p,y=Y(v);
 lines+='<line x1="'+L+'" y1="'+y+'" x2="'+(W-R)+'" y2="'+y+'" stroke="#e7edf4"/><text x="'+(L-9)+'" y="'+(y+4)+'" text-anchor="end" font-size="11" fill="#7a8c9b">'+number(Math.round(v))+"</text>";
 var x=minX+(maxX-minX)*p;
 labels+='<text x="'+X(x)+'" y="'+(H-13)+'" text-anchor="middle" font-size="11" fill="#7a8c9b">'+(prices?Math.round(x):new Date(x).getFullYear())+"</text>";
 }
 entries.forEach(function(p){dots+='<circle cx="'+X(p.x)+'" cy="'+Y(p.y)+'" r="5" fill="#1ab98e" stroke="white" stroke-width="2"><title>'+safe(number(p.y)+(prices?" ₪":" ק״מ"))+"</title></circle>"});
 return '<svg class="ins-chart" viewBox="0 0 '+W+" "+H+'" role="img" aria-label="'+(prices?"גרף מחירי הדגם":"גרף קילומטראז׳ לפי תאריך")+'">'+lines+'<polyline fill="none" stroke="#16aa81" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" points="'+entries.map(p=>X(p.x)+","+Y(p.y)).join(" ")+'"/>'+dots+labels+"</svg>";
}
function layout(){return [
'<div class="ins-header"><div class="ins-eyebrow">CarScope Insights</div><h2>היסטוריה, חריגות והשוואת מחירים</h2><p>ניתוח שקוף לפי מקורות מאומתים או נתונים שאתה בוחר להוסיף. הנתונים המקומיים נשמרים רק בדפדפן הזה.</p></div>',
'<div class="ins-grid"><div class="ins-box"><div class="ins-title"><h3>קילומטראז׳ לאורך זמן</h3><span>זיהוי חריגות</span></div>',
'<p class="ins-copy">המאגר הממשלתי מציג רק ק״מ בטסט האחרון. קריאות שנשלפות היום יישמרו לצורך השוואה בבדיקות עתידיות; אפשר להזין מסמכי טסט קודמים.</p>',
'<div id="insKmChart"></div><div id="insKmAlerts"></div><div id="insKmRows"></div>',
'<details class="ins-details"><summary>+ הוספת קריאת ק״מ מטסט ישן</summary><form id="insKmForm" class="ins-form">',
'<label>תאריך הקריאה<input id="insKmDate" type="date" required></label>',
'<label>ק״מ רשום<input id="insKmValue" type="number" min="0" max="2000000" required placeholder="למשל 95000"></label>',
'<label>מקור המסמך<select id="insKmSource"><option>טסט / רישיון רכב</option><option>חשבונית מוסך</option><option>צילום מד אוץ</option><option>דברי המוכר (ללא אימות)</option></select></label>',
'<button class="ins-primary" type="submit">שמור והשווה</button></form></details>',
'<div class="ins-compare"><label>הק״מ שהמוכר מצהיר עכשיו (רשות)</label><div><input id="insSeller" type="number" min="0" max="2000000" placeholder="ק״מ במודעה"><button id="insCompare" type="button">השווה</button></div><div id="insSellerAlert"></div></div>',
'</div><div class="ins-box"><div class="ins-title"><h3>ידיים, השכרות וליסינג</h3><span>בדיקת מקוריות</span></div>',
'<div id="insOwnerInfo"></div><div id="insOwnerAlerts"></div><div id="insOwnerRows"></div>',
'<p class="ins-copy">רישומי סוחר עשויים להופיע כמה פעמים ולא בהכרח מוסיפים ״יד״ ברישיון. נתונים חסרים לא מוכיחים בעלות פרטית.</p></div></div>',
'<div class="ins-box ins-full"><div class="ins-title"><h3>מחירון וגרף מחירי הדגם</h3><span>מקורות להשוואה</span></div>',
'<div class="ins-links"><a target="_blank" rel="noopener noreferrer" id="insYad" href="https://www.yad2.co.il/price-list">מחירון יד2 ↗</a>',
'<a target="_blank" rel="noopener noreferrer" href="https://levi-itzhak.co.il/%D7%A8%D7%9B%D7%91">מחירון לוי יצחק ↗</a>',
'<a target="_blank" rel="noopener noreferrer" href="https://www.yad2.co.il/vehicles/cars">מודעות יד2 ↗</a></div>',
'<p class="ins-copy">למחירונים אין חיבור API מורשה במערכת. הוסף מחירים ממודעות או מחירונים לצורך השוואה; אין להציג אותם כאילו נשלפו אוטומטית. הגרף מציג חציון לפי שנתון, כשהוזנו לפחות שני שנתונים.</p>',
'<div id="insPriceChart"></div><div id="insPriceSummary"></div><div id="insPriceRows"></div>',
'<details class="ins-details"><summary>+ הוספת מחיר אמיתי ממודעה / מחירון</summary><form id="insPriceForm" class="ins-form ins-priceform">',
'<label>שנת דגם<input id="insPriceYear" type="number" min="1980" max="2030" required></label>',
'<label>מחיר ₪<input id="insPriceValue" type="number" min="1000" max="10000000" required></label>',
'<label>מקור המחיר<select id="insPriceSource"><option>מודעת מכירה</option><option>מחירון יד2</option><option>מחירון לוי יצחק</option><option>מחיר עסקה ידוע</option></select></label>',
'<label>גרסה / מנוע (רשות)<input id="insPriceTrim" maxlength="60" placeholder="למשל Prime 1.6"></label>',
'<label class="ins-wide">קישור למקור (רשות)<input id="insPriceUrl" type="url" placeholder="https://"></label>',
'<button class="ins-primary" type="submit">הוסף לגרף</button></form></details>',
'<p class="ins-copy">שימו לב: נקודות ממודעות הן מחירי בקשה, לא בהכרח מחירי עסקאות. רמות גימור וקילומטראז׳ עשויים לשנות את השווי משמעותית.</p></div>'
].join("")}
function rememberGov(){
 var n=Number(report.history?.lastMileage);
 if(report.sources?.mileage!=="found"||!Number.isFinite(n)||n<0)return;
 var date=dateValue(report.vehicle?.lastTestDate)||today();
 if(!validDate(date))date=today();
 var arr=load("mileage");
 if(!arr.some(x=>x.date===date&&Number(x.value)===n&&x.kind==="gov")){
  arr.push({id:"gov-"+Date.now(),date:date,value:n,kind:"gov",source:report.vehicle?.lastTestDate?"משרד התחבורה — תאריך טסט":"משרד התחבורה — תאריך תצפית"});
  save("mileage",arr);
 }
}
function kmView(){
 var a=load("mileage").filter(x=>validDate(x.date)&&Number.isFinite(Number(x.value)));
 a.sort((x,y)=>x.date.localeCompare(y.date)||x.value-y.value);
 var uniq=a.filter((x,i)=>!a.slice(0,i).some(y=>y.date===x.date&&Number(y.value)===Number(x.value)));
 el("insKmChart").innerHTML=chart(uniq,false);
 var flags=[];
 for(var i=1;i<uniq.length;i++){
  var p=uniq[i-1],q=uniq[i],days=(Date.parse(q.date)-Date.parse(p.date))/86400000,diff=q.value-p.value;
  if(days===0&&diff!==0)flags.push(notice("קריאות סותרות באותו תאריך: "+number(p.value)+" ו־"+number(q.value)+" ק״מ. בדוק את המקורות.","danger"));
  else if(diff < -100)flags.push(notice("חשד לירידה במד האוץ: "+number(p.value)+" → "+number(q.value)+" ק״מ בין "+p.date+" ו־"+q.date+". דורש אימות מסמכים.","danger"));
  else if(days>30&&diff>10000&&diff/days*365>80000)flags.push(notice("עלייה חריגה של כ־"+number(Math.round(diff/days*365))+" ק״מ בשנה. ייתכן שימוש אינטנסיבי או טעות בנתון.","warn"));
 }
 if(!flags.length&&uniq.length>1)flags.push(notice("לא נמצאה נסיגה בנתונים הקיימים. זה אינו אישור שמד האוץ לא שונה.","good"));
 el("insKmAlerts").innerHTML=flags.join("");
 el("insKmRows").innerHTML=uniq.map(x=>'<div class="ins-row"><span><b>'+number(x.value)+' ק״מ</b><small>'+safe(x.date)+" · "+safe(x.source)+(x.kind==="gov"?" · מאגר ממשלתי":" · הוזן ידנית")+'</small></span>'+(x.kind==="gov"?"":'<button data-delk="'+safe(x.id)+'">מחק</button>')+"</div>").join("");
 var seller=load("seller")[0],current=report.history?.lastMileage==null?null:Number(report.history.lastMileage);
 el("insSeller").value=seller?.value??"";
 el("insSellerAlert").innerHTML=seller&&current!==null&&Number.isFinite(current)?(seller.value+1000<current?notice("הצהרת המוכר ("+number(seller.value)+") נמוכה מקריאת הטסט ("+number(current)+"). יש לאמת את מד האוץ.","danger"):notice("הפער מהטסט האחרון: "+number(seller.value-current)+" ק״מ. הבדל חיובי עשוי להיות טבעי.","good")):"";
}
function ownerView(){
 var h=report.history||{},v=report.vehicle||{},a=h.ownership||[],origin=String(h.origin||"").trim();
 var fleet=a.filter(x=>isFleet(x.type)),non=a.filter(x=>isNotPrivate(x.type)),currentType=String(v.currentOwnership||"").trim();
 var risk=fleet.length||isFleet(origin)||isFleet(currentType);
 el("insOwnerInfo").innerHTML='<div class="ins-ownergrid"><div><small>רשומות בעלות</small><b>'+a.length+'</b></div><div><small>מקוריות</small><b>'+safe(origin||"לא זמינה")+'</b></div><div><small>בעלות נוכחית</small><b>'+safe(v.currentOwnership||"לא זמינה")+"</b></div></div>";
 var msg=risk?notice("נמצאה אינדיקציה להשכרה, ליסינג או בעלות מוסדית. חובה לבדוק ברישיון הרכב.","danger"):non.length||isNotPrivate(origin)||isNotPrivate(currentType)?notice("קיימת בעלות שאינה פרטית (ייתכן סוחר). יש לבחון את משמעותה.","warn"):a.length?notice("הרשומות הזמינות מציגות בעלויות פרטיות בלבד. עדיין אין כאן אישור לכל ההיסטוריה.","good"):notice("לא התקבלו רשומות בעלות — אי אפשר להסיק שהרכב היה רק בבעלות פרטית.");
 el("insOwnerAlerts").innerHTML=msg;
 el("insOwnerRows").innerHTML=a.map(x=>'<div class="ins-row '+(isNotPrivate(x.type)?"nonprivate":"")+'"><span><b>'+safe(x.type||"לא ידוע")+'</b><small>'+safe(String(x.date||""))+'</small></span>'+(isNotPrivate(x.type)?'<span class="ins-risk">לא פרטי</span>':"")+"</div>").join("");
}
function priceView(){
 var arr=load("prices"),group={};
 arr.forEach(x=>{if(Number(x.value)>0)(group[x.year]??=[]).push(Number(x.value))});
 var points=Object.keys(group).sort().map(year=>{var a=group[year].sort((x,y)=>x-y),m=Math.floor(a.length/2);return {year:Number(year),value:a.length%2?a[m]:(a[m-1]+a[m])/2}});
 el("insPriceChart").innerHTML=chart(points,true);
 el("insPriceSummary").innerHTML=arr.length?notice("נשמרו "+arr.length+" מחירים שהזנת, ב־"+points.length+" שנתונים. עבור כל שנתון מוצג חציון."):"";
 el("insPriceRows").innerHTML=arr.map(x=>'<div class="ins-row"><span><b>'+number(x.value)+' ₪ · '+safe(x.year)+'</b><small>'+safe(x.source)+" · "+safe(x.trim||"גרסה לא צוינה")+(x.url?' · <a target="_blank" rel="noopener noreferrer" href="'+safe(x.url)+'">מקור ↗</a>':"")+'</small></span><button data-delp="'+safe(x.id)+'">מחק</button></div>').join("");
 el("insPriceYear").value=report.vehicle?.year||new Date().getFullYear();
}
function install(){
 if(root)return;
 root=document.createElement("section");root.id="carscope-insights";
 root.innerHTML=layout();el("report").appendChild(root);
 el("insKmDate").max=today();el("insKmDate").value=today();
 el("insKmForm").addEventListener("submit",function(e){
  e.preventDefault();
  var date=el("insKmDate").value,n=Number(el("insKmValue").value);
  if(!validDate(date)||!Number.isInteger(n)||n<0||n>2000000){alert("נתוני הק״מ אינם תקינים");return}
  var a=load("mileage");a.push({id:"km-"+Date.now(),kind:"manual",date:date,value:n,source:el("insKmSource").value});save("mileage",a);
  e.target.reset();el("insKmDate").value=today();kmView();
 });
 el("insCompare").addEventListener("click",function(){
  var n=el("insSeller").value.trim();
  if(n!==""&&(!Number.isInteger(Number(n))||Number(n)<0||Number(n)>2000000)){alert("ק״מ לא תקין");return}
  save("seller",n===""?[]:[{value:Number(n)}]);kmView();
 });
 el("insPriceForm").addEventListener("submit",function(e){
  e.preventDefault();var year=Number(el("insPriceYear").value),p=Number(el("insPriceValue").value),url=el("insPriceUrl").value.trim();
  if(!Number.isInteger(year)||year<1980||year>2030||!Number.isFinite(p)||p<1000||p>10000000||url&&!/^https?:\/\/\S+$/.test(url)){alert("פרטי המחיר אינם תקינים");return}
  var a=load("prices");a.push({id:"price-"+Date.now(),year:year,value:p,source:el("insPriceSource").value,trim:el("insPriceTrim").value.trim(),url:url});save("prices",a);
  el("insPriceValue").value="";el("insPriceUrl").value="";priceView();
 });
 root.addEventListener("click",function(e){
  var km=e.target.closest("[data-delk]"),p=e.target.closest("[data-delp]");
  if(km){save("mileage",load("mileage").filter(x=>x.id!==km.dataset.delk));kmView()}
  if(p){save("prices",load("prices").filter(x=>x.id!==p.dataset.delp));priceView()}
 });
}
document.addEventListener("carscope:report",function(e){
 if(!e.detail?.plate)return;
 report=e.detail;install();rememberGov();kmView();ownerView();priceView();
 var v=report.vehicle||{};
 if(v.year)el("insYad").href="https://www.yad2.co.il/price-list/feed?min-year="+encodeURIComponent(v.year)+"&max-year="+encodeURIComponent(v.year);
});
})();