const test=require('node:test');
const assert=require('node:assert/strict');
const core=require('../carscope-core.js');
const {mgZs2019}=require('./fixtures.js');

test('parses a typical Hebrew listing',()=>{
 const l=core.parseListing('אם ג׳י ZS 2019\nיד 2\n45,000 ק״מ\nמחיר: 62,000 ₪\nמיקום: חיפה');
 assert.equal(l.km,45000);assert.equal(l.price,62000);assert.equal(l.hand,2);assert.equal(l.location,'חיפה');
});
test('handles "אלף", word hands and shekel suffixes',()=>{
 const l=core.parseListing('יד שנייה, 85 אלף קמ, 59 אלף ש"ח, שנת 2019');
 assert.equal(l.km,85000);assert.equal(l.price,59000);assert.equal(l.hand,2);assert.equal(l.year,2019);
});
test('does not confuse price with km',()=>{
 const l=core.parseListing('₪ 70.000 | קילומטראז׳: 120,500');
 assert.equal(l.price,70000);assert.equal(l.km,120500);
});
test('missing fields stay null',()=>{
 const l=core.parseListing('רכב שמור מאוד');
 assert.deepEqual([l.price,l.km,l.hand,l.year,l.location],[null,null,null,null,null]);
});
test('flags km lower than last test (28845001 fixture)',()=>{
 const r=core.compareListing(core.parseListing('15,000 ק"מ'),mgZs2019());
 assert.equal(r[0].level,'high');assert.equal(r[0].gov,22653);
});
test('accepts km above last test',()=>{
 const r=core.compareListing(core.parseListing('30,000 ק"מ'),mgZs2019());
 assert.equal(r[0].level,'ok');
});
test('flags stated hand below non-dealer ownership records',()=>{
 // fixture: 3 records, 2 private + 1 dealer
 const r=core.compareListing(core.parseListing('יד 1'),mgZs2019());
 assert.equal(r[0].level,'high');assert.equal(r[0].gov,2);
 assert.equal(core.compareListing(core.parseListing('יד 2'),mgZs2019())[0].level,'ok');
});
test('flags year mismatch',()=>{
 const r=core.compareListing(core.parseListing('שנת 2020'),mgZs2019());
 assert.equal(r[0].level,'high');
});
test('no government data means info, not mismatch',()=>{
 const r=core.compareListing(core.parseListing('יד 1, 15,000 ק"מ'),{plate:'1'});
 assert.ok(r.every(x=>x.level==='info'));
});
test('market links search make/model/year without country suffix',()=>{
 const links=core.marketLinks({manufacturer:"אם.ג'י. סין",model:'ZS',year:2019});
 const fb=links.find(l=>l.id==='facebook');
 assert.equal(fb.query,"אם.ג'י. ZS 2019");
 assert.match(fb.url,/minYear=2019&maxYear=2019/);
 assert.match(links.find(l=>l.id==='yad2').url,/year=2019-2019/);
 assert.deepEqual(core.marketLinks({manufacturer:'x'}),[]);
});
