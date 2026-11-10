(function(root){
  'use strict';
  const messages={
    tower:['수전 전력 과부하가 감지되었습니다. 부하 분산이 필요합니다.','수전 전압 편차가 감지되었습니다. 전원 상태를 점검하세요.'],
    ess:['배터리 온도 상한 초과가 감지되었습니다. 냉각 상태를 점검하세요.','배터리 잔량 저하가 감지되었습니다. 충전 계획을 확인하세요.'],
    ups:['UPS 출력 과부하가 감지되었습니다. 연결 부하를 점검하세요.','UPS 배터리 점검이 필요합니다. 배터리 상태를 확인하세요.'],
    solar:['인버터 보호 정지 이력이 발생했습니다. 인버터 상태를 점검하세요.','태양광 발전 효율 저하가 감지되었습니다. 패널 상태를 점검하세요.'],
    other:['과전류가 감지되었습니다. 설비 부하와 보호 장치를 점검하세요.','운전 전류 편차가 감지되었습니다. 설비 상태를 점검하세요.']
  };
  // Session-local historical examples, independent of actual telemetry and project storage.
  function createAlerts(equipment,now,catalog=[]){
    const timestamp=+new Date(now);if(!Number.isFinite(timestamp))return [];
    const types=new Map(catalog.map(asset=>[asset.type,asset.name]));
    return equipment.map((item,index)=>{
      const severity=index%3===0?'danger':'warning',type=item.type.startsWith('solar')?'solar':item.type;
      return {id:item.id+':'+index,equipmentId:item.id,equipmentName:item.name,equipmentType:item.type,typeName:types.get(item.type)||item.type,severity,read:false,
        timestamp:new Date(timestamp-(2+index*7)*60000).toISOString(),message:(messages[type]||messages.other)[severity==='danger'?0:1]};
    });
  }
  function selectAlerts(alerts,{status='all',equipmentType='all',sort='latest'}={}){
    const latest=(a,b)=>Date.parse(b.timestamp)-Date.parse(a.timestamp);
    return alerts.filter(a=>(status==='all'||a.severity===status)&&(equipmentType==='all'||a.equipmentType===equipmentType)).sort((a,b)=>{
      if(sort==='severity')return (a.severity==='danger'?0:1)-(b.severity==='danger'?0:1)||latest(a,b);
      if(sort==='equipment')return a.typeName.localeCompare(b.typeName,'ko',{numeric:true})||a.equipmentName.localeCompare(b.equipmentName,'ko',{numeric:true})||latest(a,b);
      return latest(a,b);
    });
  }
  function setRead(alerts,id,read){return alerts.map(alert=>id===null||alert.id===id?{...alert,read:!!read}:alert);}
  const unreadCount=alerts=>alerts.filter(alert=>!alert.read).length;
  if(typeof module!=='undefined'&&module.exports){module.exports={createAlerts,selectAlerts,setRead,unreadCount};return;}
  const $=id=>document.getElementById(id),button=$('monitor-alerts-open'),dialog=$('monitor-alerts-dialog');
  const status=$('monitor-alerts-status'),sort=$('monitor-alerts-sort'),list=$('monitor-alerts-list'),readAll=$('monitor-alerts-read-all'),unread=$('monitor-alerts-badge');
  const clock=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
  let alerts=[],session=false;
  const element=(tag,text,opaque=false)=>{const el=document.createElement(tag);if(text!=null)el.textContent=text;if(opaque)el.setAttribute('data-i18n-skip','');return el;};
  function action(caption,path){
    const control=element('button');control.type='button';control.className='quiet icon-button';control.title=caption;control.setAttribute('aria-label',caption);
    control.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true">'+path+'</svg>';return control;
  }
  function updateBadge(){const count=unreadCount(alerts);unread.textContent=String(count);unread.hidden=count===0;readAll.disabled=count===0;}
  function render(){
    const rows=selectAlerts(alerts,{status:status.value,sort:sort.value});
    list.replaceChildren(...rows.map(alert=>{
      const tr=element('tr'),state=element('td'),badge=element('span');badge.className='monitor-alert-severity';badge.dataset.severity=alert.severity;
      tr.classList.toggle('is-read',alert.read);
      const readCell=element('td'),toggle=action('읽음',alert.read?'<path d="m3 9 9-6 9 6v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9Zm0 0 9 6 9-6M3 20l6-7m12 7-6-7"/>':'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 6 9 7 9-7"/>');
      toggle.classList.add('monitor-alert-read');toggle.setAttribute('aria-pressed',String(alert.read));toggle.title=alert.read?'안 읽음으로 표시':'읽음으로 표시';
      toggle.addEventListener('click',()=>{alerts=setRead(alerts,alert.id,!alert.read);render();list.querySelectorAll('.monitor-alert-read')[rows.indexOf(alert)]?.focus({preventScroll:true});});readCell.append(toggle);
      const caption=alert.severity==='danger'?'위험':'경고';badge.setAttribute('role','img');badge.setAttribute('aria-label',caption);badge.title=caption;
      const dot=element('i');dot.setAttribute('aria-hidden','true');badge.append(dot);state.append(badge);
      const occurred=element('td'),time=element('time',clock.format(new Date(alert.timestamp)),true);time.dateTime=alert.timestamp;occurred.append(time);
      const content=element('td');content.append(element('strong',alert.equipmentName,true),element('p',alert.message));
      const moveCell=element('td'),move=action('설비로 이동','<path d="M7 17 17 7M7 7h10v10"/>');move.classList.add('monitor-alert-locate');
      move.addEventListener('click',()=>{if(root.FEMSWorkspaceMode?.locateEquipment(alert.equipmentId))dialog.close();});moveCell.append(move);
      tr.append(readCell,state,occurred,content,moveCell);return tr;
    }));
    $('monitor-alerts-count').textContent=`표시 ${rows.length}건 / 전체 ${alerts.length}건`;
    $('monitor-alerts-empty').hidden=rows.length>0;
    updateBadge();
  }
  function sync(){
    const mock=root.FEMSMonitoringMock,enabled=root.FEMSWorkspaceMode?.mode==='monitoring'&&mock?.playing&&!!mock.current;
    button.disabled=!enabled;button.title=enabled?'알림':'목업 재생 중에 알림을 확인할 수 있습니다.';
    if(!enabled){
      alerts=[];session=false;list.replaceChildren();$('monitor-alerts-count').textContent='';
      status.value='all';sort.value='latest';updateBadge();
      if(dialog.open)dialog.close();return;
    }
    if(!session){
      const catalog=root.FEMSCatalog?.catalog||[];
      session=true;alerts=createAlerts(mock.equipment,mock.current.timestamp,catalog);
    }
    updateBadge();
  }
  button.addEventListener('click',()=>{sync();if(button.disabled||dialog.open)return;render();dialog.showModal();});
  $('monitor-alerts-close').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('close',()=>{if(!button.disabled)button.focus({preventScroll:true});});
  dialog.addEventListener('keydown',event=>{
    event.stopPropagation();if((event.ctrlKey||event.metaKey)&&['s','z','y','o','n'].includes(event.key.toLowerCase()))event.preventDefault();
  });
  readAll.addEventListener('click',()=>{alerts=setRead(alerts,null,true);render();});
  for(const control of [status,sort])control.addEventListener('change',render);
  root.addEventListener('fems-mock-update',sync);root.addEventListener('fems-workspace-mode-change',sync);sync();
})(typeof window==='undefined'?globalThis:window);
