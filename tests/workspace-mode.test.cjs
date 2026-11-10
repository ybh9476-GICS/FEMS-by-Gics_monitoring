const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
function fixture(){
  const element=(inert=false)=>({inert,dataset:{},attrs:{},events:{},setAttribute(k,v){this.attrs[k]=v;},addEventListener(k,fn){this.events[k]=fn;},focus(){context.document.activeElement=this;}});
  const details=element(true),controls=[element(),element(true)],buttons=['editor','monitoring'].map(mode=>({...element(),dataset:{workspaceMode:mode}})),classes=new Set(),events=[];
  const content=element(),tabs=['overview','solar','ess','ups'].map(dashboard=>({...element(),dataset:{dashboard},hidden:dashboard!=='overview'}));
  const body={dataset:{},classList:{toggle(k,value){if(value)classes.add(k);else classes.delete(k);}}};
  const overview={visible:null,active:null,show(value){this.active=value;this.visible=value==='overview';}};
  const context={FEMSOverviewDashboard:overview,document:{body,getElementById:id=>id==='monitor-details'?details:content,querySelectorAll:s=>s==='[data-workspace-mode]'?buttons:s==='[data-dashboard]'?tabs:controls},CustomEvent:class{constructor(type){this.type=type;}},dispatchEvent:e=>events.push(e.type)};context.window=context;
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../js/workspace-mode.js'),'utf8'),context);
  return {api:context.FEMSWorkspaceMode,body,details,controls,buttons,classes,events,tabs,content,document:context.document,overview};
}
test('관제 전환은 준비 완료 후에만 적용하며 기본은 Editor이다',()=>{
  const f=fixture();assert.equal(f.api.mode,'editor');assert.equal(f.api.setMode('monitoring'),false);
  f.api.configure({beforeChange:()=>false,afterChange(){throw Error('blocked');}});
  assert.equal(f.api.setMode('monitoring'),false);assert.equal(f.api.mode,'editor');assert.equal(f.events.length,0);
});

test('대시보드 탭은 건물·층을 포함한 전체 배치와 태양광 배열·삭제·복원 상태를 따라간다',()=>{
  const f=fixture(),shown=()=>f.tabs.filter(t=>!t.hidden).map(t=>t.dataset.dashboard);
  f.api.renderDashboard({equipment:[]});assert.deepEqual(shown(),['overview']);
  f.api.renderDashboard({equipment:[{type:'solar',floorId:'roof'},{type:'ess'},{type:'ups',floorId:'floor'}]});assert.deepEqual(shown(),['overview','solar','ess','ups']);
  for(const type of ['solar','solar-2x2','solar-3x3'])for(const floorId of [undefined,'roof','floor']){
    const state={equipment:[{type,floorId},{type:'ess',floorId},{type:'ups',floorId},{type:'panel'}]},before=JSON.stringify(state);
    f.api.renderDashboard(state);assert.deepEqual(shown(),['overview','solar','ess','ups']);assert.equal(JSON.stringify(state),before);
    f.tabs[1].events.click();assert.equal(f.content.attrs['aria-labelledby'],'monitor-tab-solar');assert.equal(f.overview.visible,false);assert.equal(f.overview.active,'solar');
    f.api.renderDashboard(state);assert.equal(f.tabs[1].attrs['aria-selected'],'true');
    f.tabs[1].focus();f.api.renderDashboard({equipment:[]});assert.deepEqual(shown(),['overview']);
    assert.equal(f.content.attrs['aria-labelledby'],'monitor-tab-overview');assert.equal(f.document.activeElement,f.tabs[0]);assert.equal(f.overview.visible,true);
    f.api.renderDashboard(state);assert.deepEqual(shown(),['overview','solar','ess','ups']);
  }
});

test('대시보드 키보드 전환은 숨긴 탭을 건너뛰고 끝에서 순환한다',()=>{
  const f=fixture();f.api.renderDashboard({equipment:[{type:'ups'}]});
  const key=(tab,key)=>tab.events.keydown({key,preventDefault(){},stopPropagation(){}});
  key(f.tabs[0],'ArrowRight');assert.equal(f.document.activeElement,f.tabs[3]);assert.equal(f.tabs[3].tabIndex,0);
  key(f.tabs[3],'ArrowRight');assert.equal(f.document.activeElement,f.tabs[0]);
  key(f.tabs[0],'End');assert.equal(f.document.activeElement,f.tabs[3]);
  key(f.tabs[3],'Home');assert.equal(f.document.activeElement,f.tabs[0]);
});
test('관제 패널은 선택에 따라 열리고 편집 UI의 원래 접근 상태를 복원한다',()=>{
  const f=fixture(),calls=[];f.api.configure({beforeChange:n=>calls.push('before:'+n),afterChange:n=>calls.push('after:'+n)});
  assert.equal(f.api.setMode('monitoring'),true);assert.ok(f.controls.every(e=>e.inert));assert.equal(f.details.inert,true);
  f.api.selection(true);assert.equal(f.details.inert,false);assert.equal(f.details.attrs['aria-hidden'],'false');assert.ok(f.classes.has('monitor-details-open'));
  f.api.selection(false);assert.equal(f.details.inert,true);assert.ok(!f.classes.has('monitor-details-open'));
  f.api.setMode('editor');assert.deepEqual(f.controls.map(e=>e.inert),[false,true]);f.api.selection(true);assert.equal(f.details.inert,true);
  assert.deepEqual(f.buttons.map(e=>e.attrs['aria-pressed']),['true','false']);assert.equal(f.api.setMode('unknown'),false);assert.equal(f.api.setMode('editor'),false);
  assert.deepEqual(calls,['before:monitoring','after:monitoring','before:editor','after:editor']);assert.equal(fixture().api.mode,'editor');
});

test('관제의 건물·층·설비 선택은 공간 진입이나 프로젝트 변경 없이 처리한다',()=>{
  const source=fs.readFileSync(path.join(__dirname,'../js/app.js'),'utf8'),start=source.indexOf('  function selectMonitoring('),end=source.indexOf('  function reparent(',start);
  const state={equipment:[{id:'machine',floorId:'floor'}],buildings:[{id:'building'}],floors:[{id:'floor',buildingId:'building'}]};
  const calls=[],c={history:{current:state},S:require('../js/spatial.js'),spaces:{context:{buildingId:'building'},selected:null},view:'3d',scene:{focusEquipment(id){calls.push(id);}},render(){calls.push('render');}};
  vm.createContext(c);vm.runInContext(source.slice(start,end),c);const before=JSON.stringify(state);
  for(const id of ['building','floor','machine',null]){
    calls.length=0;
    c.selectMonitoring(id);assert.equal(c.spaces.selected,id==='building'||id==='floor'?id:null);assert.equal(c.selected,id==='machine'?id:null);
    assert.deepEqual(c.spaces.context,{buildingId:'building'});assert.equal(JSON.stringify(state),before);
    assert.deepEqual(calls,id==='machine'?['render','machine']:['render']);
  }
  c.view='plan';calls.length=0;c.selectMonitoring('machine');assert.deepEqual(calls,['render','machine']);
  c.view='schematic';calls.length=0;c.selectMonitoring('machine');assert.deepEqual(calls,['render']);
});

test('관제 건물·층 빌보드는 실제 공간 탐색을 실행하고 뒤로가기·설비 선택·데이터를 보존한다',()=>{
  const source=fs.readFileSync(path.join(__dirname,'../js/app.js'),'utf8');
  const state={site:{width:60,depth:40},equipment:[{id:'machine',floorId:'floor'}],buildings:[{id:'building'}],floors:[{id:'floor',buildingId:'building'},{id:'standalone'}]};
  const calls=[],c={history:{current:state},S:require('../js/spatial.js'),FEMSSpatial:require('../js/spatial.js'),FEMSWorkspaceMode:{mode:'monitoring'},view:'3d',scene:{focusEquipment:id=>calls.push('focus:'+id)},render(){calls.push('render');}};
  c.window=c;vm.createContext(c);vm.runInContext(fs.readFileSync(path.join(__dirname,'../js/spatial-ui.js'),'utf8'),c);
  c.spaces=Object.create(c.FEMSSpatialUI.prototype);
  Object.assign(c.spaces,{context:{},selected:null,api:{state:()=>state,clearEquipment(){c.selected=null;c.selectedIds=[];},disarm(){},refresh:c.render,fit(options){assert.equal(options.preserveAngle,true);calls.push('fit');}}});
  vm.runInContext(source.slice(source.indexOf('  function select('),source.indexOf('  function reparent(')),c);
  const before=JSON.stringify(state);
  c.select('building',undefined,false,true);assert.equal(c.spaces.context.buildingId,'building');assert.equal(c.spaces.context.floorId,undefined);assert.equal(c.spaces.selected,'building');
  c.select('floor',undefined,false,true);assert.equal(c.spaces.context.floorId,'floor');assert.equal(c.spaces.context.buildingId,'building');
  c.select('machine',undefined,false,true);assert.equal(c.selected,'machine');assert.equal(c.spaces.context.floorId,'floor');assert.equal(calls.at(-1),'focus:machine');
  c.spaces.back();assert.equal(c.spaces.context.buildingId,'building');assert.equal(c.spaces.context.floorId,undefined);assert.equal(c.selected,null);
  c.spaces.back();assert.equal(Object.keys(c.spaces.context).length,0);
  c.select('standalone',undefined,false,true);assert.equal(c.spaces.context.floorId,'standalone');
  c.selectMonitoring(null);assert.equal(c.spaces.context.floorId,'standalone');assert.equal(c.selected,null);
  assert.equal(calls.filter(v=>v==='fit').length,4);assert.equal(JSON.stringify(state),before);
});
