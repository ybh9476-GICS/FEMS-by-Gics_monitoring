const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const root={};vm.runInNewContext(fs.readFileSync('js/view-session.js','utf8'),{window:root});
const api=root.FEMSViewSession;
const plain=value=>JSON.parse(JSON.stringify(value));
const project={project:{id:'project-a'},equipment:[{id:'pump'}],buildings:[{id:'building'}],floors:[{id:'floor',buildingId:'building'}]};
function storage(){const data=new Map();return {getItem:key=>data.get(key)||null,setItem:(key,value)=>data.set(key,value)};}
const snapshot={mode:'monitoring',view:'plan',sceneMode:'plan',context:{floorId:'floor',buildingId:'building'},selectedIds:['pump'],
  camera:{target:{x:13,y:2,z:-7},radius:34,yaw:.7,pitch:.8,planYaw:1.2},showLabels:false,
  diagram:{scale:1.7,offset:{x:-130,y:57},search:'pump',neighbors:true,fitted:true},dashboard:'ess',dashboardScroll:350};
test('reload snapshot preserves mode, space, selection, camera and diagram without changing project data',()=>{
  const store=storage(),before=JSON.stringify(project);
  assert.equal(api.save(store,project,snapshot),true);
  const saved=plain(api.read(store,project));
  for(const key of Object.keys(snapshot))assert.deepEqual(saved[key],snapshot[key]);
  assert.equal(JSON.stringify(project),before);
});
test('another project, unknown schema and malformed storage are ignored',()=>{
  const store=storage();api.save(store,project,snapshot);
  assert.equal(api.read(store,{...project,project:{id:'project-b'}}),null);
  assert.equal(api.read({getItem:()=>'{oops'},project),null);
  assert.equal(api.read({getItem:()=>JSON.stringify({...snapshot,version:2,projectId:'project-a'})},project),null);
  assert.equal(api.read(storage(),project),null);
});
test('removed equipment and spaces do not restore dangling selections',()=>{
  const store=storage();api.save(store,project,{...snapshot,spaceSelected:'floor'});
  const saved=plain(api.read(store,{...project,equipment:[],floors:[],buildings:[]}));
  assert.deepEqual(saved.selectedIds,[]);assert.deepEqual(saved.context,{});assert.equal(saved.spaceSelected,null);
});
test('invalid numeric camera and diagram values are rejected independently',()=>{
  for(const invalid of [NaN,Infinity,-5,'30']){
    const store=storage();api.save(store,project,{...snapshot,camera:{...snapshot.camera,radius:invalid},diagram:{...snapshot.diagram,scale:invalid}});
    const saved=api.read(store,project);assert.equal(saved.camera,null);assert.equal(saved.diagram,null);assert.equal(saved.mode,'monitoring');
  }
});
test('storage denial does not prevent startup or modify project data',()=>{
  const store={getItem(){throw Error('blocked');},setItem(){throw Error('quota');}};
  assert.equal(api.read(store,project),null);assert.equal(api.save(store,project,snapshot),false);
});
test('editor return state survives monitoring reload; unopened diagrams remain unfitted',()=>{
  const store=storage();api.save(store,project,{...snapshot,editor:{...snapshot,view:'3d',selectedIds:['pump','pump','deleted'],diagram:{...snapshot.diagram,fitted:false}}});
  const saved=plain(api.read(store,project));assert.equal(saved.editor.view,'3d');assert.deepEqual(saved.editor.selectedIds,['pump']);assert.equal(saved.editor.diagram.fitted,false);
});
