// CarBoard public listing metadata importer — no credentials, no private/session access.
const allowHost = h => /(^|\.)((yad2\.co\.il)|(homeless\.co\.il)|(carwiz\.co\.il)|(freesbe\.co\.il)|(facebook\.com)|(fb\.com)|(marketplace\.facebook\.com)|(autodeal\.co\.il)|(trade-mobil\.co\.il)|(autocenter\.co\.il)|(autocenter\.co\.il)|(carzone\.co\.il)|(avis\.co\.il)|(shlomo\.co\.il)|(albar\.co\.il)|(budget\.co\.il))$/i.test(h);
const dec = t=>String(t??'').replace(/&(#x[0-9a-f]+|#[0-9]+|amp|quot|apos|lt|gt|nbsp|shy);?/gi,(_,s)=>{
  const a=s.toLowerCase();if(a[0]==='#'){const n=a[1]==='x'?parseInt(a.slice(2),16):parseInt(a.slice(1),10);return n>0&&n<0x110000?String.fromCodePoint(n):''}return ({amp:'&',quot:'"',apos:"'",lt:'<',gt:'>',nbsp:' ',shy:''})[a]??_;
}).replace(/\s+/g,' ').trim();
const clean=t=>dec(String(t??'').replace(/<[^>]*>/g,'')).slice(0,2400);
const nval=t=>{if(t===null||t===undefined)return null;let s=String(t).replace(/[\s,₪]/g,'');let m=s.match(/\d+/);return m?Number(m[0]):null};
const validImage=(link,base)=>{try{let u=new URL(link,base);return (u.protocol==='https:'||u.protocol==='http:')&&!['localhost','127.0.0.1'].includes(u.hostname)?u.href:null}catch{return null}};
function metas(html) {
 const map={};
 for(const tag of (html.match(/<meta\b[^>]*>/gi)||[])){
  const attrs={};for(const m of tag.matchAll(/([a-zA-Z:_-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g))attrs[m[1].toLowerCase()]=m[2]??m[3]??m[4];
  const key=(attrs.property||attrs.name||attrs.itemprop||'').toLowerCase();
  if(key&&attrs.content)map[key]=dec(attrs.content);
 }return map;
}
function jsonLD(html) {
 const nodes=[];for(const m of html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)){
 try{const j=JSON.parse(m[1].replace(/<!--|-->/g,''));const walk=(v,depth=0)=>{if(depth>5||!v||typeof v!=='object')return;if(Array.isArray(v)){v.forEach(z=>walk(z,depth+1));return}nodes.push(v);if(v['@graph'])walk(v['@graph'],depth+1);if(v.mainEntity)walk(v.mainEntity,depth+1);if(v.itemListElement)walk(v.itemListElement,depth+1)};walk(j)}catch{}
 }return nodes;
}
function extract(html,url) {
 const m=metas(html), nodes=jsonLD(html);
 const first=(...parts)=>parts.find(x=>x!==undefined&&x!==null&&String(x).trim())||'';
 const listing=nodes.find(x=>/vehicle|car|product|offer/i.test(String(x['@type']||'')))||nodes[0]||{};
 const offer=Array.isArray(listing.offers)?listing.offers[0]:listing.offers||{};
 const price=first(m['product:price:amount'],m['og:price:amount'],offer.price,offer.lowPrice,listing.price);
 const hTitle=(html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)||[])[1];
 const tTitle=(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)||[])[1];
 let title=clean(first(m['og:title'],m['twitter:title'],listing.name,hTitle,tTitle));
 const desc=clean(first(m['og:description'],m.description,m['twitter:description'],listing.description));
 const text=(title+' '+desc).replace(/\s+/g,' ');
 const year=first(listing.vehicleModelDate,listing.productionDate,(text.match(/\b(20(?:0\d|1\d|2\d))\b/)||[])[1]);
 const mileage=first(listing.mileageFromOdometer?.value,listing.mileageFromOdometer,(text.match(/([\d,.]{2,9})\s*(?:ק[״"']?מ|קילומטר(?:ים)?|km)\b/i)||[])[1]);
 const hand=(text.match(/(?:^|[^\p{L}])יד\s*([1-9])(?:\b|[^\d])/u)||[])[1];
 const priceText=(text.match(/(?:₪\s*([\d,.]{4,9})|([\d,.]{4,9})\s*₪)/)||[]);
 let asked=nval(price)||nval(priceText[1]||priceText[2]);
 if(asked&&asked<3000)asked=null;
 const rawImages=[m['og:image'],m['og:image:url'],m['twitter:image'],m['twitter:image:src'],listing.image,...nodes.flatMap(z=>Array.isArray(z.image)?z.image:[z.image])];
 const images=rawImages.flatMap(x=>Array.isArray(x)?x:[x]).map(x=>typeof x==='object'?(x?.url||x?.contentUrl):x).map(x=>validImage(x,url)).filter(Boolean).filter((v,i,a)=>a.indexOf(v)===i).slice(0,8);
 const loc=listing.address?.addressLocality||listing.location?.name||'';
 const found={title:title||null,description:desc||null,price:asked,year:nval(year),km:nval(mileage),hand:nval(hand),location:clean(loc),images};
 if(!found.title&&html.length>200)found.title='מודעת רכב';
 const extracted=Object.entries(found).filter(([k,v])=>k!=='images'&&v!==null&&v!=='').map(([k])=>k);
 if(images.length)extracted.push('images');
 return {fields:found,extracted,confidence:extracted.length>=4?'medium':extracted.length>=2?'low':'none'};
}
module.exports=async function handler(req,res){
 res.setHeader('Access-Control-Allow-Origin','https://aviadchai.github.io');
 res.setHeader('Access-Control-Allow-Methods','GET, OPTIONS');
 res.setHeader('Access-Control-Allow-Headers','Content-Type');
 res.setHeader('Cache-Control','public, max-age=0, s-maxage=120');
 if(req.method==='OPTIONS')return res.status(204).end();
 if(req.method!=='GET')return res.status(405).json({error:'method_not_allowed'});
 let url;try{url=new URL(String(req.query.url||''));if(url.protocol!=='https:'||!allowHost(url.hostname))throw Error('invalid source')}catch{return res.status(400).json({error:'unsupported_url',message:'הקישור חייב להיות לאתר רכב נתמך, עם HTTPS.'})}
 let current=url.href;
 try{
  let response;
  for(let i=0;i<4;i++){
   response=await fetch(current,{headers:{'Accept':'text/html,application/xhtml+xml','User-Agent':'CarBoardMetadataImporter/1.0 (public web metadata)'},redirect:'manual',signal:AbortSignal.timeout(10000)});
   if([301,302,303,307,308].includes(response.status)){
    const to=new URL(response.headers.get('location')||'',current);
    if(to.protocol!=='https:'||!allowHost(to.hostname))throw Error('redirect_not_allowed');
    current=to.href;continue;
   }break;
  }
  if(!response||!response.ok){return res.status(200).json({status:'blocked',source:url.hostname,url:url.href,fields:{},message:'לא התקבל עמוד ציבורי שאפשר לקרוא. ניתן להוסיף צילום מסך או להדביק את תיאור המודעה.',httpStatus:response?.status||null})}
  if(!/html/i.test(response.headers.get('content-type')||''))return res.status(200).json({status:'blocked',source:url.hostname,url:url.href,fields:{},message:'הקישור אינו מחזיר עמוד HTML ציבורי.'});
  const html=(await response.text()).slice(0,2500000);
  if(/(?:login|log in|sign in|התחבר\/י).{0,30}(?:facebook|פייסבוק)/i.test(html.slice(0,4500))&&url.hostname.includes('facebook'))return res.status(200).json({status:'blocked',source:url.hostname,url:url.href,fields:{},message:'פייסבוק מציגה דף התחברות ולא את המודעה. לא ניתן לייבא תמונות ופרטים שאינם ציבוריים.'});
  const ext=extract(html,current);
  return res.status(200).json({status:ext.extracted.length?'partial':'blocked',source:url.hostname,url:url.href,...ext,message:ext.extracted.length?'זוהו פרטים ציבוריים מהעמוד. יש לוודא אותם מול המודעה.':'לא נמצאו פרטי מודעה קריאים. אפשר לצרף צילום מסך ולהשלים את השדות.'});
 }catch(e){return res.status(200).json({status:'blocked',source:url.hostname,url:url.href,fields:{},message:'לא ניתן לקרוא את המודעה כרגע. אפשר להוסיף פרטים וצילומי מסך.',reason:String(e.message||'fetch error').slice(0,80)})}
};
