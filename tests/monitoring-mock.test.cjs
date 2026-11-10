const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const {createModel}=require('../js/monitoring-mock.js');
const items=[{id:'grid',type:'tower',name:'GRID'},{id:'pv',type:'solar-3x3',name:'PV'},{id:'ess',type:'ess',name:'ESS'},{id:'ups',type:'ups',name:'UPS'},{id:'pump',type:'pump',name:'Pump'}];
const date=s=>new Date(s+'+09:00'),near=(a,b,tolerance=1e-6)=>assert.ok(Math.abs(a-b)<tolerance,`${a} != ${b}`);
test('목업은 금일 경과 시간만 합산하고 전주·전년·월말·연도·윤년 경계를 처리한다',()=>{
  const model=createModel(.42),before=JSON.stringify(items);
  for(const when of ['2026-11-10T15:23:47','2027-01-01T00:00:00','2028-02-29T12:01:00','2026-03-01T00:00:10']){
    const s=model.snapshot(date(when),items),m=Number(when.slice(11,13))*60+Number(when.slice(14,16))+Number(when.slice(17))/60;
    assert.equal(s.date,when.slice(0,10));near(s.overview.today.reduce((sum,v)=>sum+(v||0),0),s.overview.total);
    s.overview.today.forEach((value,i)=>{if(i*120>=m)assert.equal(value,null);else assert.ok(value>=0);});
    assert.ok(s.overview.peak.time<=s.time);assert.ok(s.solar.peak.time<=s.time);assert.ok(s.emissions[0].value>=s.emissions[1].value);
  }
  const jan=model.snapshot(date('2027-01-01T00:00:00'),items);assert.equal(jan.overview.total,0);assert.equal(jan.overview.yesterdayDate,'2026-12-31');assert.equal(jan.emissions[2].start,'2026-12-01');assert.equal(jan.emissions[2].end,'2026-12-31');assert.equal(jan.ess.monthCharge,0);
  const leap=model.snapshot(date('2028-02-29T12:01:00'),items);assert.equal(leap.overview.yearDate,'2027-02-28');
  const tuesday=model.snapshot(date('2026-11-10T15:23:47'),items);assert.equal(tuesday.overview.weekRange,'2026-11-02–2026-11-08');assert.equal(JSON.stringify(items),before);
});
test('공장 전력·UPS·ESS·태양광 값은 일관된 범위이며 야간 발전은 0이다',()=>{
  const model=createModel(.17);
  for(const hour of [0,5,9,13,17,23]){
    const s=model.snapshot(date(`2026-11-10T${String(hour).padStart(2,'0')}:30:00`),items);
    assert.ok(s.overview.power>200&&s.overview.power<s.overview.contract);near(s.overview.load,s.overview.power/s.overview.contract*100);
    assert.ok(s.ess.soc>=30&&s.ess.soc<=85);near(s.ess.stored,s.ess.soc*10);assert.ok(s.ess.monthCharge>=s.ess.charge);assert.ok(s.ess.monthDischarge>=s.ess.discharge);
    near(s.solar.inverters.reduce((sum,i)=>sum+i.power,0),s.solar.power);assert.ok(s.solar.power<=s.solar.capacity);
    assert.equal(s.metrics.ups[0],s.ups[0].input.toFixed(1));assert.equal(s.metrics.grid[1],Number(s.overview.power.toFixed(1)).toLocaleString('en-US',{minimumFractionDigits:1}));
    for(const values of Object.values(s.metrics))for(const value of values)assert.match(value,/^-?[\d,]+\.\d$/);
    assert.equal(s.metrics.grid[0],'1,500.0');assert.equal(s.metrics.ups[1],'380.0');assert.equal(s.metrics.pump[3],'1.0');
    assert.ok(s.ups[0].load>0&&s.ups[0].load<100);assert.ok(s.ups[0].battery<=100);assert.equal(s.ups[0].frequency,60);
    if(hour===0||hour===23){assert.equal(s.solar.power,0);assert.ok(!['clear-day'].includes(s.weather.condition));}
    if(hour===0)assert.equal(s.solar.energy,0);
  }
  const empty=model.snapshot(date('2026-11-10T12:00:00'),[]);assert.equal(empty.ups.length,0);assert.equal(empty.solar.power,0);assert.equal(empty.ess.charge,0);
});
test('10초 변화는 완만하고 누적 전력량은 감소하지 않는다',()=>{
  const model=createModel(.5),first=model.snapshot(date('2026-11-10T10:59:55'),items),next=model.snapshot(date('2026-11-10T11:00:05'),items);
  assert.notEqual(first.overview.power,next.overview.power);assert.ok(Math.abs(next.overview.power-first.overview.power)/first.overview.power<.02);
  assert.ok(next.overview.total>first.overview.total);assert.ok(next.solar.energy>=first.solar.energy);
  assert.ok(first.weather.humidity>=30&&first.weather.humidity<=98);assert.ok(first.weather.temperature>-20&&first.weather.temperature<40);
});
test('재생·정지·모드 전환과 설비 목록 변경은 타이머와 목업만 변경하고 프로젝트를 보존한다',()=>{
  const listeners={},timers=new Map();let now=+date('2026-11-10T15:00:00'),id=0;
  const c={Date:class extends Date{constructor(...args){super(...(args.length?args:[now]));}},FEMSWorkspaceMode:{mode:'monitoring'},CustomEvent:class{constructor(type){this.type=type;}},
    addEventListener(type,fn){(listeners[type]??=[]).push(fn);},dispatchEvent(e){for(const fn of listeners[e.type]||[])fn(e);},setInterval(fn,ms){assert.equal(ms,10000);timers.set(++id,fn);return id;},clearInterval(id){timers.delete(id);}};c.window=c;
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../js/monitoring-mock.js'),'utf8'),c);
  const api=c.FEMSMonitoringMock,state={equipment:items},before=JSON.stringify(state);api.configure(state);
  c.dispatchEvent({type:'fems-workspace-mode-change'});assert.equal(api.current,null);assert.equal(timers.size,0);assert.equal(api.values(items[0]),undefined);assert.equal(api.status('grid'),undefined);
  assert.equal(api.equipment.length,items.length);api.equipment[0].name='changed';assert.equal(api.equipment[0].name,'GRID');
  api.start();assert.equal(timers.size,1);const original=api.current;assert.ok(api.values(items[0]));assert.equal(api.status('grid'),'normal');
  now+=10000;for(const fn of timers.values())fn();assert.notEqual(api.current.timestamp,original.timestamp);
  api.start();assert.equal(timers.size,1);api.stop();now+=60000;assert.equal(timers.size,0);assert.equal(api.current,null);assert.equal(api.values(items[0]),undefined);assert.equal(api.status('grid'),undefined);
  api.start();assert.equal(api.current.timestamp,new Date(now).toISOString());c.FEMSWorkspaceMode.mode='editor';c.dispatchEvent({type:'fems-workspace-mode-change'});assert.equal(api.playing,false);assert.equal(timers.size,0);
  api.start();assert.equal(timers.size,0);assert.equal(JSON.stringify(state),before);
  c.FEMSWorkspaceMode.mode='monitoring';c.dispatchEvent({type:'fems-workspace-mode-change'});assert.equal(api.current,null);assert.equal(api.playing,false);
  api.configure({equipment:[]});assert.equal(api.current,null);
});
