const test=require('node:test');
const assert=require('node:assert/strict');
const api=require('../api/vehicle.js');
test('normalizes plate punctuation',()=>assert.equal(api.normalizedPlate('48-700-37'),'4870037'));
test('rejects short and long plate numbers',()=>{assert.equal(api.normalizedPlate('123'),null);assert.equal(api.normalizedPlate('123456789'),null)});
test('keeps missing vehicle fields null',()=>{const v=api.vehicleData({shnat_yitzur:2016,kinuy_mishari:'TUCSON'});assert.equal(v.year,2016);assert.equal(v.model,'TUCSON');assert.equal(v.fuel,null)});
test('missing record returns null',()=>assert.equal(api.vehicleData(null),null));
