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
test('관제 계통도는 이름과 네 계측 항목만 표시하고 편집 복귀 시 원래 내용을 복원한다',()=>{
  const {scene,selected}=fixture(),before=JSON.stringify(scene.state);scene.draw();
  let card=scene.nodeElements.get('a');
  assert.deepEqual(card.children.filter(e=>e.tag==='text').map(e=>e.textContent),['Grid','전압(V)','—','전류(A)','—','유효전력(kW)','—','역률(pF)','—']);
  assert.equal(card.attrs['data-communication-status'],'disconnected');
  assert.equal(card.attrs['aria-label'],'Grid');assert.equal(card.attrs['data-i18n-site-suffix'],undefined);
  const layout=JSON.stringify(scene.layout),edgeCount=scene.edgeElements.size;
  card.events.click();assert.deepEqual(selected,['a']);assert.equal(card.focused,true);
  card.events.keydown({key:'Enter',preventDefault(){},stopPropagation(){}});assert.deepEqual(selected,['a','a']);
  scene.setReadOnly(false);card=scene.nodeElements.get('a');
  assert.deepEqual(card.children.filter(e=>e.tag==='text').map(e=>e.textContent),['Grid','GRID-01','대지']);
  assert.equal(card.attrs['data-communication-status'],undefined);
  assert.equal(JSON.stringify(scene.layout),layout);assert.equal(scene.edgeElements.size,edgeCount);
  scene.setReadOnly(true);assert.equal(scene.nodeElements.get('a').attrs['data-communication-status'],'disconnected');
  assert.equal(JSON.stringify(scene.state),before);
});
test('통신 변경은 기존 카드·계층 색상·연결선을 보존하면서 상태 바에 반영된다',()=>{
  const {scene}=fixture();let reported='normal';scene.api.communicationStatus=id=>id==='a'?reported:'disconnected';scene.draw();
  const card=scene.nodeElements.get('a'),edge=scene.edgeElements.values().next().value;
  const fill=card.children.find(e=>e.attrs.class==='schematic-card').attrs;
  for(const status of ['error','normal','disconnected','unknown',undefined]){
    reported=status;scene.draw();assert.equal(scene.nodeElements.get('a'),card);assert.equal(scene.edgeElements.values().next().value,edge);
    assert.equal(card.attrs['data-communication-status'],status==='normal'||status==='error'?status:'disconnected');
    assert.equal(card.attrs['data-tone'],'0');assert.deepEqual(card.children.find(e=>e.attrs.class==='schematic-card').attrs,fill);
  }
});
