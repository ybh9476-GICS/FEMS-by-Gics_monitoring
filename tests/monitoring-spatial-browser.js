// Uses the isolated server's capture hooks. The fixture never commits or saves project data.
document.getElementById('run').onclick=async()=>{
  const output=document.getElementById('results'),w=document.getElementById('app').contentWindow,d=w.document,results=[];
  const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  const check=(ok,name)=>{if(!ok)throw Error(name);results.push('PASS '+name);output.textContent=results.join('\n');};
  const click=selector=>d.querySelector(selector).click();
  const mode=async next=>{click('#settings-open');click(`[data-workspace-mode="${next}"]`);click('#settings-done');await wait(350);};
  try{
    const scene=w.testScene,h=w.testHistory;check(!!scene&&!!h,'실제 장면과 이력 준비');
    if(w.FEMSWorkspaceMode.mode!=='editor')await mode('editor');
    w.FEMSI18n.setLanguage('ko');
    const saved=w.localStorage.getItem(w.FEMSModel.STORAGE_KEY),past=h.past.length,future=h.future.length;
    const manifest=await (await fetch('../assets/equipment/index.json')).json(),asset=manifest.assets.find(a=>a.kind==='building');
    check(!!asset,'실제 건물 에셋 준비');w.FEMSCatalog.register([asset]);
    const M=w.FEMSModel,S=w.FEMSSpatial;
    let state=w.FEMSProjectFile.attach(S.upgrade(w.FEMSConnections.enableShared(M.empty())),[asset]);state.site={width:70,depth:60};
    const building={...S.create(state,asset),name:'관제 검증동',width:24,depth:20,height:12};state.buildings.push(building);
    state=S.registerFloors(state,building.id,S.slots(2,0,false,12));
    const floor=state.floors.find(f=>f.level==='1F');
    const equipment={...M.create('ess',state,2,3),name:'층 내부 ESS',floorId:floor.id};state.equipment.push(equipment);
    h.current=M.validate(state);const before=JSON.stringify(h.current);
    await mode('monitoring');await mode('editor');click('#view-3d');click('#fit');await wait(400);
    const originalCamera=JSON.stringify({target:scene.target.toArray(),radius:scene.radius,mode:scene.mode});
    await mode('monitoring');
    const canvas=scene.renderer.domElement;canvas.setPointerCapture=()=>{};canvas.hasPointerCapture=()=>false;
    const choose=async id=>{
      scene.updateLabels();const label=scene.labels.get(id);check(label&&!label.hidden,'빌보드 표시: '+id);
      const r=label.getBoundingClientRect(),clientX=(r.left+r.right)/2,clientY=(r.top+r.bottom)/2;
      check(scene.pickLabel({clientX,clientY})===id,'빌보드 클릭 대상 일치: '+id);
      for(const type of ['pointerdown','pointerup'])canvas.dispatchEvent(new w.PointerEvent(type,{clientX,clientY,button:0,pointerId:91,bubbles:true}));
      await wait(600);
    };
    for(const view of ['3d','plan']){
      click('#view-'+view);click('#fit');await wait(200);
      await choose(building.id);check(scene.state.equipment.some(e=>e.id===floor.id&&e.floorSelector),view+': 건물 진입 후 층 표시');
      await choose(floor.id);check(scene.state.scopeFloorId===floor.id,view+': 층 진입');
      await choose(equipment.id);check(scene.selected===equipment.id&&scene.labels.get(equipment.id).classList.contains('equipment-info-open'),view+': 내부 설비 선택·빌보드 확장');
      click('.space-navigation');await wait(300);check(!scene.state.scopeFloorId&&scene.state.equipment.some(e=>e.id===floor.id&&e.floorSelector),view+': 건물로 뒤로가기');
      click('.space-navigation');await wait(300);check(!scene.state.equipment.some(e=>e.floorSelector),view+': 대지로 뒤로가기');
    }
    check(JSON.stringify(h.current)===before&&h.past.length===past&&h.future.length===future,'프로젝트·실행 취소 이력 보존');
    check(w.localStorage.getItem(M.STORAGE_KEY)===saved,'자동 저장 원본 보존');
    await mode('editor');check(JSON.stringify({target:scene.target.toArray(),radius:scene.radius,mode:scene.mode})===originalCamera,'편집 모드 시점 복원');
    await mode('monitoring');await choose(building.id);await choose(floor.id);await choose(equipment.id);
    output.textContent=results.join('\n')+`\n${results.length} passed, 0 failed`;
  }catch(error){output.textContent=results.join('\n')+'\nERROR '+error.stack;}
};
