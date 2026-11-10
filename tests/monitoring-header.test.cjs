const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
function fixture(){
  const elements=new Map(),events={},documentEvents={},timers=new Map();let next=0,now=Date.parse('2026-11-10T14:59:59Z');
  const element=()=>({dataset:{},attrs:{},events:{},textContent:'',setAttribute(k,v){this.attrs[k]=v;},addEventListener(k,fn){this.events[k]=fn;}});
  const document={hidden:false,getElementById(id){if(!elements.has(id))elements.set(id,element());return elements.get(id);},addEventListener(k,fn){documentEvents[k]=fn;}};
  const c={document,Intl,Date:class extends Date{constructor(){super(now);}},FEMSWorkspaceMode:{mode:'editor'},addEventListener(k,fn){events[k]=fn;},setInterval(fn,ms){assert.equal(ms,1000);timers.set(++next,fn);return next;},clearInterval(id){timers.delete(id);}};c.window=c;
  c.FEMSMonitoringMock={playing:false,start(){this.playing=true;events['fems-mock-update']();},stop(){this.playing=false;events['fems-mock-update']();}};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../js/monitoring-header.js'),'utf8'),c);
  return {c,e:id=>document.getElementById(id),timers,mode(value){c.FEMSWorkspaceMode.mode=value;events['fems-workspace-mode-change']();},hidden(value){document.hidden=value;documentEvents.visibilitychange();},tick(){now+=1000;for(const fn of timers.values())fn();}};
}
test('관제 시각은 한국 시간의 날짜 경계를 반영하고 숨김·에디터에서 타이머를 중지한다',()=>{
  const f=fixture();assert.equal(f.timers.size,0);f.mode('monitoring');
  assert.equal(f.e('monitor-clock').textContent,'2026-11-10 23:59:59');f.tick();
  assert.equal(f.e('monitor-clock').textContent,'2026-11-11 00:00:00');assert.equal(f.e('monitor-clock').dateTime,'2026-11-10T15:00:00.000Z');
  f.mode('monitoring');assert.equal(f.timers.size,1);f.hidden(true);assert.equal(f.timers.size,0);f.hidden(false);assert.equal(f.timers.size,1);
  f.mode('editor');assert.equal(f.timers.size,0);f.mode('monitoring');assert.equal(f.timers.size,1);
});
test('재생·정지는 목업 서비스에 연결하고 현재 시각 갱신을 멈추지 않는다',()=>{
  const f=fixture(),button=f.e('monitor-play-toggle');f.mode('monitoring');
  button.events.click();assert.equal(button.attrs['aria-pressed'],'true');assert.equal(button.attrs['aria-label'],'정지');
  const before=f.e('monitor-clock').textContent;f.tick();assert.notEqual(f.e('monitor-clock').textContent,before);
  button.events.click();assert.equal(button.attrs['aria-pressed'],'false');assert.equal(button.attrs['aria-label'],'재생');assert.equal(f.timers.size,1);
});
test('날씨는 다섯 상태와 온습도를 표시하고 잘못된 값은 미연결 상태로 처리한다',()=>{
  const f=fixture(),api=f.c.FEMSMonitoringHeader;
  for(const condition of ['clear-day','clear-night','cloudy','rain','snow']){
    const data={condition,temperature:-1.25,humidity:62.4},before=JSON.stringify(data);api.setWeather(data);
    assert.equal(f.e('monitor-weather').dataset.weather,condition);assert.equal(f.e('monitor-temperature').textContent,'-1.3 °C');assert.equal(f.e('monitor-humidity').textContent,'62.4 %');assert.equal(JSON.stringify(data),before);
  }
  api.setWeather({condition:'cloudy',temperature:20,humidity:50});
  assert.equal(f.e('monitor-temperature').textContent,'20.0 °C');assert.equal(f.e('monitor-humidity').textContent,'50.0 %');
  for(const data of [null,{condition:'other',temperature:20,humidity:50},{condition:'rain',temperature:null,humidity:50},{condition:'snow',temperature:10,humidity:101}]){
    api.setWeather(data);assert.equal(f.e('monitor-weather').dataset.weather,'unavailable');assert.equal(f.e('monitor-temperature').textContent,'— °C');assert.equal(f.e('monitor-humidity').textContent,'— %');
  }
});
