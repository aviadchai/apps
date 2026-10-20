// Fixture modeled on plate 28845001 as described by the owner (MG ZS 2019,
// 3 ownership records, currently with a dealer, 22,653 km at last test).
// Dates and other values are test inputs, not fetched government data.
function mgZs2019(overrides={}){
 return {
  plate:"28845001",
  vehicle:{manufacturer:"אם.ג'י. סין",model:"ZS",year:2019,currentOwnership:"סוחר",
   lastTestDate:"2026-03-10",registrationExpiry:"2027-03-09",firstOnRoad:"2019-6"},
  history:{lastMileage:22653,ownership:[
   {date:"201906",type:"פרטי"},{date:"202305",type:"פרטי"},{date:"202608",type:"סוחר"}]},
  datasets:{recalls:{status:"empty",records:[]},cancelled:{status:"empty",records:[]}},
  ...overrides
 };
}
module.exports={mgZs2019};
