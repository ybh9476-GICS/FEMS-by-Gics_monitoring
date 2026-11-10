/* Run on the isolated 4183 origin, with real WebGL, DOM events and History. */
document.getElementById('run').onclick=async()=>{
  const output=document.getElementById('results'),frame=document.getElementById('app');
  const w=frame.contentWindow,d=w.document,results=[];
  const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  const check=(ok,name)=>{results.push(`${ok?'PASS':'FAIL'} ${name}`);output.textContent=results.join('\n');if(!ok)throw new Error(name);};
  const visible=selector=>{const el=d.querySelector(selector),style=el&&w.getComputedStyle(el);return !!el&&style.display!=='none'&&style.visibility!=='hidden'&&el.getBoundingClientRect().width>0;};
  const click=selector=>d.querySelector(selector).click();
  const key=(value,extra={})=>d.body.dispatchEvent(new w.KeyboardEvent('keydown',{key:value,bubbles:true,cancelable:true,...extra}));
  const mode=async value=>{click('#settings-open');click(`[data-workspace-mode="${value}"]`);click('#settings-done');await wait(350);};
  try{
    check(!!w.testScene&&!!w.testHistory,'실제 장면과 변경 이력 로드');
    const scene=w.testScene,h=w.testHistory,canvas=scene.renderer.domElement;
    // Synthetic pointer events have no native capture. Only the fixture replaces capture.
    canvas.setPointerCapture=()=>{};canvas.hasPointerCapture=()=>false;
    const pointer=(type,x,y,extra={})=>canvas.dispatchEvent(new w.PointerEvent(type,{clientX:x,clientY:y,button:0,pointerId:71,bubbles:true,...extra}));
    const point=id=>{scene.updateCamera();const p=scene.models.get(id).position.clone(),item=scene.state.equipment.find(e=>e.id===id);p.y+=(item.height||0)/2;p.project(scene.camera);const r=canvas.getBoundingClientRect();return [r.left+(p.x+1)*r.width/2,r.top+(1-p.y)*r.height/2];};
    const select=id=>{const p=point(id);pointer('pointerdown',...p);pointer('pointerup',...p);};
    const current=()=>JSON.stringify(h.current),camera=()=>JSON.stringify({target:scene.target.toArray(),radius:scene.radius,yaw:scene.yaw,pitch:scene.pitch,planYaw:scene.planYaw});
    const item=h.current.equipment.find(e=>!e.floorId);check(!!item,'지상 설비 테스트 대상');
    click('#view-3d');select(item.id);await wait(100);
    check(scene.selected===item.id,'Editor: 객체 선택');
    const original=current();key('r');await wait(50);
    check(current()!==original,'Editor: 회전 단축키');click('#undo');check(current()===original,'Editor: 실행 취소');click('#redo');check(current()!==original,'Editor: 다시 실행');click('#undo');
    select(item.id);
    const before=current(),savedBefore=w.localStorage.getItem(w.FEMSModel.STORAGE_KEY),past=h.past.length,future=h.future.length;
    const editorCamera=camera(),leftWidth=d.querySelector('.catalog-panel').getBoundingClientRect().width,rightWidth=d.querySelector('.inspector').getBoundingClientRect().width;
    for(const lang of ['ko','en','ja']){
      w.FEMSI18n.setLanguage(lang);await mode('monitoring');
      check(w.FEMSWorkspaceMode.mode==='monitoring',`${lang}: 관제 전환`);
      check(!visible('.catalog-panel')&&!visible('.inspector')&&!visible('.equipment-dock')&&!visible('#save')&&!visible('#align-horizontal')&&!visible('#undo'),`${lang}: 편집 UI 숨김`);
      check(d.querySelector('.editor').getBoundingClientRect().left<5,`${lang}: 작업 화면 좌측 확장`);
      check(visible('#monitor-dashboard')&&!visible('#monitor-details'),`${lang}: 대시보드 및 우측 패널 기본 숨김`);
      click('[data-dashboard=overview]');
      check(d.querySelectorAll('[data-dashboard-panel=overview] .dashboard-card').length===6&&visible('[data-dashboard-panel=overview]'),`${lang}: 통합 대시보드 6개 카드`);
      check(d.querySelector('#monitor-dashboard').getBoundingClientRect().height===280,`${lang}: 대시보드 높이 최적화`);
      const strip=d.querySelector('.dashboard-strip');
      check(strip.scrollWidth>strip.clientWidth,`${lang}: 대시보드 가로 스크롤 영역`);
      click('#dashboard-scroll-right');await wait(400);check(strip.scrollLeft>0,`${lang}: 다음 카드 스크롤`);
      click('#dashboard-scroll-left');await wait(400);check(strip.scrollLeft<2,`${lang}: 첫 카드 복귀`);
      const types=new Set(h.current.equipment.map(e=>e.type));
      for(const [name,shown] of Object.entries({overview:true,solar:['solar','solar-2x2','solar-3x3'].some(type=>types.has(type)),ess:types.has('ess'),ups:types.has('ups')})){
        check(visible('[data-dashboard='+name+']')===shown,`${lang}: ${name} 건물·층 포함 전체 배치 표시 조건`);
        if(shown){click('[data-dashboard='+name+']');check(d.querySelector('#monitor-dashboard-content').getAttribute('aria-labelledby')==='monitor-tab-'+name,`${lang}: ${name} 탭 전환`);check(['overview','solar','ups','ess'].every(panel=>visible('[data-dashboard-panel='+panel+']')===(name===panel)),`${lang}: ${name} 본문 분리`);}
      }
      select(item.id);await wait(350);
      check(scene.selected===item.id&&visible('#monitor-details'),`${lang}: 객체 선택 후 상세 패널 슬라이딩`);
      check(!scene.gizmo.group.visible&&d.querySelector('#gizmo-rotate').hidden,`${lang}: 이동·회전 기즈모 숨김`);
      for(const value of ['r','Delete','Backspace'])key(value);
      for(const value of ['z','y','s','o','n','d'])key(value,{ctrlKey:true});
      const x=d.querySelector('#properties [name=x]');x.value=100;x.dispatchEvent(new w.Event('input',{bubbles:true}));
      check(current()===before&&h.past.length===past&&h.future.length===future,`${lang}: 단축키·속성 입력 변경 차단 및 이력 보존`);
      const transfer=new w.DataTransfer();transfer.setData('application/x-fems-equipment','panel');
      canvas.dispatchEvent(new w.DragEvent('drop',{dataTransfer:transfer,bubbles:true,cancelable:true}));
      check(current()===before,`${lang}: 카탈로그 드롭 배치 차단`);
      for(const view of ['plan','3d']){
        click('#view-'+view);await wait(100);select(item.id);await wait(300);
        const p=point(item.id),camBefore=camera();scene.move=true;
        pointer('pointerdown',...p);pointer('pointermove',p[0]+40,p[1]+25);pointer('pointerup',p[0]+40,p[1]+25);scene.move=false;
        check(current()===before&&camera()!==camBefore,`${lang}/${view}: 객체 드래그는 카메라만 이동`);
        const radius=scene.radius;click('#zoom-in');check(scene.radius!==radius,`${lang}/${view}: 확대 조작 유지`);
        check(scene.pickGizmo({})===null,`${lang}/${view}: 기즈모 선택 차단`);
        const line=scene.connections.lines.find(l=>l.points.length>1);
        if(line){const a=line.points[0],b=line.points[1],p3=new w.THREE.Vector3((a.x+b.x)/2,line.height||.1,(a.z+b.z)/2).project(scene.camera),r=canvas.getBoundingClientRect();
          const hit=scene.pickTarget({clientX:r.left+(p3.x+1)*r.width/2,clientY:r.top+(1-p3.y)*r.height/2});check(!hit.link&&!hit.axis,`${lang}/${view}: 연결선·편집 핸들 선택 차단`);}
      }
      key('Escape');await wait(300);check(!visible('#monitor-details'),`${lang}: 선택 해제로 우측 패널 숨김`);
      click('#view-schematic');await wait(100);
      const search=d.querySelector('#schematic input[type=search]');
      for(const value of ['r','f','Delete','Backspace']){const event=new w.KeyboardEvent('keydown',{key:value,bubbles:true,cancelable:true});search.dispatchEvent(event);check(!event.defaultPrevented,`${lang}: 계통도 검색 입력 ${value} 허용`);}
      const edge=d.querySelector('.schematic-edge');check(!!edge,'계통도 연결선 존재');edge.dispatchEvent(new w.MouseEvent('click',{bubbles:true}));edge.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Enter',bubbles:true}));
      check(edge.getAttribute('tabindex')==='-1'&&!d.querySelector('.schematic-edge.selected'),`${lang}: 계통도 연결선 마우스·키보드 선택 차단`);
      d.querySelector('.schematic-node').dispatchEvent(new w.MouseEvent('click',{bubbles:true}));await wait(350);check(visible('#monitor-details'),`${lang}: 계통도 객체 선택`);
      check(current()===before&&w.localStorage.getItem(w.FEMSModel.STORAGE_KEY)===savedBefore,`${lang}: 프로젝트·자동 저장 데이터 보존`);
      await mode('editor');
      check(visible('.catalog-panel')&&visible('.inspector')&&visible('.equipment-dock')&&visible('#save')&&!visible('#monitor-dashboard'),`${lang}: Editor UI 복원`);
      check(scene.selected===item.id&&scene.mode==='3d'&&camera()===editorCamera,`${lang}: Editor 선택·보기·카메라 복원`);
      check(Math.abs(d.querySelector('.catalog-panel').getBoundingClientRect().width-leftWidth)<1&&Math.abs(d.querySelector('.inspector').getBoundingClientRect().width-rightWidth)<1,`${lang}: Editor 패널 너비 보존`);
      check(scene.gizmo.group.visible,`${lang}: Editor 기즈모 재활성화`);
    }
    // Check a real edit after repeated mode switches, including undo/redo.
    key('r');check(current()!==before,'Editor 복귀 후 실제 회전 가능');click('#undo');check(current()===before,'Editor 복귀 후 실행 취소 및 데이터 복원');click('#redo');check(current()!==before,'Editor 복귀 후 다시 실행');click('#undo');
    const second=h.current.equipment.find(e=>!e.floorId&&e.id!==item.id);select(item.id);
    const p=point(second.id);pointer('pointerdown',...p,{ctrlKey:true});pointer('pointerup',...p,{ctrlKey:true});
    const group=JSON.stringify(scene.selectedIds);check(scene.selectedIds.length===2,'Editor 다중 선택');
    await mode('monitoring');select(item.id);await mode('editor');check(JSON.stringify(scene.selectedIds)===group,'Editor 다중 선택 복원');
    const encoded=await w.FEMSProjectFile.encode(h.current,w.FEMSAssets.readBytes),decoded=await w.FEMSProjectFile.decode(encoded.bytes);
    check(JSON.stringify(decoded.drawing.equipment)===JSON.stringify(h.current.equipment),'모드 전환 후 프로젝트 파일 저장·불러오기 데이터 보존');
    output.textContent=results.join('\n')+`\n\n${results.length} passed, 0 failed`;
  }catch(error){output.textContent=results.join('\n')+'\nERROR '+error.stack;}
};
