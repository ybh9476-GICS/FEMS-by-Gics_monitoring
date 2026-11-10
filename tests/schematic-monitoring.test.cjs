const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
function fixture(){
  function element(tag){return {tag,attrs:{},children:[],events:{},textContent:'',
    setAttribute(k,v){this.attrs[k]=String(v);},getAttribute(k){return this.attrs[k];},
    append(...children){this.children.push(...children);},replaceChildren(){this.children=[];},
    addEventListener(k,fn){this.events[k]=fn;},focus(){this.focused=true;},classList:{toggle(){}}};}
  const c={FEMSSchematicLayout:require('../js/schematic-layout.js'),FEMSCatalog:require('../js/catalog.js'),document:{createElementNS(ns,tag){return element(tag);}}};c.window=c;
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../js/schematic.js'),'utf8'),c);
  const scene=Object.create(c.FEMSSchematic.prototype),selected=[];
  Object.assign(scene,{active:true,readOnly:true,scale:1,offset:{x:0,y:0},api:{select:id=>selected.push(id)},
    search:{value:''},neighbors:{checked:false},locate:{},empty:{},svg:element('svg'),
    state:{site:{},equipment:[{id:'a',name:'Grid',type:'grid',code:'GRID-01'},{id:'b',name:'ESS',type:'ess',parentId:'a'}]}});
  return {scene,selected};
}
test('관제 계통도는 이름과 설비별 계측 항목을 표시하고 편집 복귀 시 원래 내용을 복원한다',()=>{
  const {scene,selected}=fixture(),before=JSON.stringify(scene.state);scene.draw();
  let card=scene.nodeElements.get('a');
  assert.deepEqual(card.children.filter(e=>e.tag==='text').map(e=>e.textContent),['Grid','전압(V)','—','전류(A)','—','유효전력(kW)','—','역률(pF)','—']);
  assert.equal(card.attrs['data-communication-status'],'disconnected');
  const icon=card.children.find(e=>e.attrs.class==='schematic-card-accent');
  const title=card.children.find(e=>e.attrs.class==='schematic-node-name');
  assert.equal(Number(icon.attrs.y)+Number(icon.attrs.height),Number(title.attrs.y));
  assert.ok(Number(icon.attrs.x)+Number(icon.attrs.width)<Number(title.attrs.x));
  assert.equal(icon.attrs.height,'10');
  assert.equal(card.attrs['aria-label'],'Grid');assert.equal(card.attrs['data-i18n-site-suffix'],undefined);
  const layout=JSON.stringify(scene.layout),edgeCount=scene.edgeElements.size;
  card.events.click();assert.deepEqual(selected,['a']);assert.equal(card.focused,true);
  card.events.keydown({key:'Enter',preventDefault(){},stopPropagation(){}});assert.deepEqual(selected,['a','a']);
  scene.setReadOnly(false);card=scene.nodeElements.get('a');
  assert.deepEqual(card.children.filter(e=>e.tag==='text').map(e=>e.textContent),['Grid','GRID-01','대지']);
  assert.equal(card.attrs['data-communication-status'],undefined);
  assert.equal(Number(card.children.find(e=>e.attrs.class==='schematic-card-accent').attrs.height),scene.layout.nodes.find(n=>n.id==='a').height-20);
  assert.equal(JSON.stringify(scene.layout),layout);assert.equal(scene.edgeElements.size,edgeCount);
  scene.setReadOnly(true);assert.equal(scene.nodeElements.get('a').attrs['data-communication-status'],'disconnected');
  assert.equal(JSON.stringify(scene.state),before);
});
test('모든 설비의 계통도 빌보드는 3D·평면도 기준 항목과 순서·미연결 값을 표시한다',()=>{
  const {scene}=fixture(),catalog=require('../js/catalog.js');
  const expected={
    tower:['계약 전력(kW)','유효 전력(kW)','부하율(%)'],
    solar:['일간 발전량(kWh)','일간 발전 시간(h)','입력 전력(kW)','출력 전력(kW)'],
    ess:['일간 충전량(kWh)','일간 방전량(kWh)','일간 효율(%)'],
    ups:['입력 전압(Vac)','출력 전압(Vac)','배터리(%)','유효전력(kW)']
  };
  const fallback=['전압(V)','전류(A)','유효전력(kW)','역률(pF)'];
  scene.state.equipment=[...catalog.builtin.map(def=>def.type),'asset-custom','unknown'].map((type,index)=>({id:'type-'+index,name:type,type}));
  const before=JSON.stringify(scene.state);scene.draw();
  for(const item of scene.state.equipment){
    const captions=expected[item.type]||(['solar-2x2','solar-3x3'].includes(item.type)?expected.solar:fallback);
    const card=scene.nodeElements.get(item.id),texts=card.children.filter(e=>e.tag==='text');
    assert.deepEqual(texts.slice(1).map(e=>e.textContent),captions.flatMap(caption=>[caption,'—']),item.type);
    assert.ok(texts.slice(1).filter((_,i)=>i%2===0).every(e=>e.attrs['data-i18n-ui']===''));
    assert.equal(card.attrs['data-communication-status'],'disconnected');
    assert.ok(texts.every(e=>Number(e.attrs.y)<scene.layout.nodes.find(n=>n.id===item.id).height));
  }
  assert.equal(JSON.stringify(scene.state),before);
});
test('통신 변경은 기존 카드·계층 색상·연결선을 보존하면서 제목 옆 아이콘에 반영된다',()=>{
  const {scene}=fixture();let reported='normal';scene.api.communicationStatus=id=>id==='a'?reported:'disconnected';scene.draw();
  const card=scene.nodeElements.get('a'),edge=scene.edgeElements.values().next().value;
  const fill=card.children.find(e=>e.attrs.class==='schematic-card').attrs;
  for(const status of ['error','normal','disconnected','unknown',undefined]){
    reported=status;scene.draw();assert.equal(scene.nodeElements.get('a'),card);assert.equal(scene.edgeElements.values().next().value,edge);
    assert.equal(card.attrs['data-communication-status'],status==='normal'||status==='error'?status:'disconnected');
    assert.equal(card.attrs['data-tone'],'0');assert.deepEqual(card.children.find(e=>e.attrs.class==='schematic-card').attrs,fill);
  }
});
