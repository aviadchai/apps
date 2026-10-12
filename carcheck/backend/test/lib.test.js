import test from "node:test";
import assert from "node:assert/strict";
import {normalizePlate,normalizeVehicle,asTestDate,parseOwners,analyzeMileage} from "../src/lib.js";
test("accepts 7 or 8 digit plates",()=>{assert.equal(normalizePlate("12-345-67"),"1234567");assert.equal(normalizePlate("12345678"),"12345678");assert.equal(normalizePlate("1234"),null)});
test("treats registration date as separate from test date",()=>{assert.equal(asTestDate("2026-05-12T00:00:00"),"2026-05-12");assert.equal(asTestDate("2019"),null)});
test("maps registry record",()=>{const v=normalizeVehicle({tozeret_nm:"קיה",mivchan_acharon_dt:"2026-05-12"});assert.equal(v.manufacturer,"קיה");assert.equal(v.lastTestDate,"2026-05-12")});
test("sorts owners without inventing entries",()=>assert.equal(parseOwners([{baalut_dt:202503,baalut:"פרטי"},{baalut_dt:202002,baalut:"סוחר"}])[0].type,"סוחר"));
test("detects decreases but not harmless tiny reading noise",()=>{const a=analyzeMileage([{date:"2024-01-01",value:90000},{date:"2025-01-01",value:80000}]);assert.equal(a[0].code,"MILEAGE_DECREASE");assert.equal(analyzeMileage([{date:"2024-01-01",value:90000},{date:"2025-01-01",value:89999}]).length,0)});
test("identifies contradictory same-day values",()=>assert.equal(analyzeMileage([{date:"2025-03-01",value:12000},{date:"2025-03-01",value:22000}])[0].code,"CONFLICTING_READINGS"));
