
(function(){
"use strict";
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const safe=u=>{try{const z=new URL(u,location.href);return ['https:','http:'].includes(z.protocol)?z.href:''}catch{return''}};
const money=n=>n===null||n===undefined?'טרם ידוע':Number(n).toLocaleString('he-IL')+' ₪';
function plate(value){const s=String(value||'').replace(/\D/g,'');if(s.length!==7&&s.length!==8)return '<span class="plate-inline" style="color:#91a0af;font-size:11px">מספר רכב טרם ידוע</span>';
const v=s.length===7?s.slice(0,2)+'-'+s.slice(2,5)+'-'+s.slice(5):s.slice(0,3)+'-'+s.slice(3,5)+'-'+s.slice(5);
return '<div class="plate-inline"><span class="licenseplate"><span class="il">🇮🇱<br>IL</span><b>'+esc(v)+'</b></span></div>'}
function images(car){return(car.photos||[]).filter(p=>p&&safe(p.url)).slice(0,15)}
function thumb(car){const im=images(car)[0];return '<div class="car-picture" aria-hidden="true">'+(im?'<img loading="lazy" src="'+esc(safe(im.url))+'" alt="'+esc(im.label||'תמונת רכב')+'">':'🚙')+'</div>'}
function links(entries){return '<div class="cb-links">'+(entries||[]).filter(x=>safe(x.url)).map(x=>'<a target="_blank" rel="noopener noreferrer" href="'+esc(safe(x.url))+'">↗ '+esc(x.label||'קישור למקור')+'</a>').join('')+'</div>'}
function detail(car){
let parts=[];
const imgs=images(car);
parts.push('<div class="cb-links"><a href="../carcheck/" target="_blank" rel="noopener">◈ בדוק ב־CarScope</a>'+(safe(car.url)?'<a target="_blank" rel="noopener" href="'+esc(safe(car.url))+'">↗ פתח מודעה</a>':'')+'</div>');
if(imgs.length){parts.push('<h3 class="modal-section">תמונות הרכב מהמודעה ('+imgs.length+')</h3><div class="cb-gallery">'+imgs.map((p,i)=>'<a href="'+esc(safe(p.url))+'" target="_blank" rel="noopener"><img src="'+esc(safe(p.url))+'" loading="lazy" alt="'+esc(p.label||'תמונת מודעה '+(i+1))+'"><span>'+esc(p.label||'צילום '+(i+1))+'</span></a>').join('')+'</div>')}
if(car.sellerStatus)parts.push('<div class="cb-doc"><b>בדיקת מוכר: </b>'+esc(car.sellerStatus)+'</div>');
if(car.priceNote||car.pricebookNote)parts.push('<div class="cb-doc"><b>מחירים: </b>מחיר מבוקש '+money(car.price)+(car.weightedPrice?' | מחירון משוקלל '+money(car.weightedPrice):'')+(car.pricebookBase?' | מחירון בסיס '+money(car.pricebookBase):'')+'<p>'+esc(car.priceNote||'')+' '+esc(car.pricebookNote||'')+'</p></div>');
if(car.sourceLinks?.length){parts.push('<h3 class="modal-section">קישורים ומקורות</h3>'+links(car.sourceLinks))}
if(car.sellerClaims?.length)parts.push('<h3 class="modal-section">הצהרות המוכר (לא אומתו)</h3><div class="cb-doc">'+car.sellerClaims.map(x=>'• '+esc(x)).join('<br>')+'</div>');
if(car.documents?.length)parts.push('<h3 class="modal-section">מסמכים והצלבות</h3>'+car.documents.map(d=>'<div class="cb-doc"><strong>'+esc(d.type)+'</strong>'+esc(d.summary)+'<br><small>'+esc(d.date||'')+' · '+esc(d.source||'')+'</small></div>').join(''));
return parts.join('');
}
window.CarBoardMedia={plate,thumb,detail};
})();