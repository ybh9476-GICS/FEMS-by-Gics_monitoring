const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
function fixture(){
  const element=()=>({dataset:{},events:{},scrollLeft:0,clientWidth:400,scrollWidth:1000,hidden:false,children:[],setAttribute(){},append(child){this.children.push(child);},addEventListener(name,fn){this.events[name]=fn;},scrollBy({left}){this.scrollLeft+=left;}});
  const elements=Object.fromEntries(['monitor-dashboard-content','monitor-dashboard-tools','dashboard-scroll-left','dashboard-scroll-right'].map(id=>[id,element()]));
  const c={document:{getElementById:id=>elements[id],createElement:element},matchMedia:()=>({matches:true}),requestAnimationFrame:fn=>fn(),ResizeObserver:class{observe(){}}};c.window=c;
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../js/overview-dashboard.js'),'utf8'),c);
  return {api:c.FEMSOverviewDashboard,...Object.fromEntries(elements['monitor-dashboard-content'].children.map(panel=>[panel.dataset.dashboardPanel,panel])),tools:elements['monitor-dashboard-tools'],right:elements['dashboard-scroll-right']};
}
test('탭별 본문·스크롤을 분리하고 빈 탭 및 복귀 시 각 스크롤 위치를 보존한다',()=>{
  const f=fixture();f.api.show('overview');f.right.events.click();const position=f.overview.scrollLeft;
  f.api.show('solar');assert.equal(f.overview.hidden,true);assert.equal(f.solar.hidden,false);assert.equal(f.tools.hidden,false);
  f.right.events.click();assert.ok(f.solar.scrollLeft>0);assert.equal(f.overview.scrollLeft,position);
  const solarPosition=f.solar.scrollLeft;
  f.api.show('ups');assert.equal(f.overview.hidden,true);assert.equal(f.solar.hidden,true);assert.equal(f.ups.hidden,false);assert.equal(f.tools.hidden,false);
  f.right.events.click();assert.ok(f.ups.scrollLeft>0);assert.equal(f.overview.scrollLeft,position);assert.equal(f.solar.scrollLeft,solarPosition);
  const upsPosition=f.ups.scrollLeft;
  f.api.show('ess');assert.equal(f.overview.hidden,true);assert.equal(f.solar.hidden,true);assert.equal(f.ups.hidden,true);assert.equal(f.ess.hidden,false);assert.equal(f.tools.hidden,false);
  f.right.events.click();assert.ok(f.ess.scrollLeft>0);assert.equal(f.ups.scrollLeft,upsPosition);assert.equal(f.solar.scrollLeft,solarPosition);assert.equal(f.overview.scrollLeft,position);
  f.api.show('unknown');assert.equal(f.ess.hidden,true);assert.equal(f.tools.hidden,true);
  f.api.show('overview');assert.equal(f.overview.hidden,false);assert.equal(f.solar.hidden,true);assert.equal(f.ups.hidden,true);assert.equal(f.ess.hidden,true);assert.equal(f.overview.scrollLeft,position);
});
test('태양광 휠 스크롤은 해당 패널만 이동하며 확대 단축키와 가장자리 입력을 가로채지 않는다',()=>{
  const f=fixture();f.api.show('solar');let prevented=0;
  const event={deltaY:80,deltaX:0,deltaMode:0,preventDefault(){prevented++;}};
  f.solar.events.wheel(event);assert.equal(f.solar.scrollLeft,80);assert.equal(f.overview.scrollLeft,0);assert.equal(prevented,1);
  f.solar.events.wheel({...event,ctrlKey:true});assert.equal(f.solar.scrollLeft,80);assert.equal(prevented,1);
  f.solar.scrollLeft=600;f.solar.events.wheel(event);assert.equal(f.solar.scrollLeft,600);assert.equal(prevented,1);
});
