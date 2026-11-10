(function(root){
  'use strict';
  // Session UI state only. Project data and the default Editor Mode are unchanged.
  let mode='editor',adapter=null;
  const editorOnly='.catalog-panel,.inspector,.panel-resizer,.equipment-dock,.statusbar,.alignment-tools,#undo,#redo,.history-tools .divider,.file-actions > button:not(#settings-open)';
  const priorInert=new Map();
  const details=document.getElementById('monitor-details');
  const dashboardTabs=[...document.querySelectorAll('[data-dashboard]')];
  const dashboardContent=document.getElementById('monitor-dashboard-content');
  let dashboard='overview';
  function chooseDashboard(next){
    if(!dashboardTabs.some(button=>button.dataset.dashboard===next&&!button.hidden))return;
    dashboard=next;
    for(const button of dashboardTabs){
      const active=button.dataset.dashboard===dashboard;
      button.setAttribute('aria-selected',String(active));button.tabIndex=active?0:-1;
    }
    dashboardContent.setAttribute('aria-labelledby','monitor-tab-'+dashboard);
    root.FEMSOverviewDashboard?.show(dashboard);
  }
  function renderDashboard(state){
    // Include every placed item, including equipment on building floors and roofs.
    const types=new Set(state.equipment.map(item=>item.type));
    const available={overview:true,solar:['solar','solar-2x2','solar-3x3'].some(type=>types.has(type)),ess:types.has('ess'),ups:types.has('ups')};
    let restoreFocus=false;
    for(const button of dashboardTabs){
      const hidden=!available[button.dataset.dashboard];
      if(hidden&&document.activeElement===button)restoreFocus=true;
      button.hidden=hidden;
    }
    chooseDashboard(available[dashboard]?dashboard:'overview');
    if(restoreFocus)dashboardTabs.find(button=>button.dataset.dashboard===dashboard)?.focus();
  }
  for(const button of dashboardTabs){
    button.addEventListener('click',()=>chooseDashboard(button.dataset.dashboard));
    button.addEventListener('keydown',event=>{
      if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
      event.preventDefault();event.stopPropagation();
      const visible=dashboardTabs.filter(tab=>!tab.hidden),index=visible.indexOf(button);
      const next=event.key==='Home'?visible[0]:event.key==='End'?visible[visible.length-1]:visible[(index+(event.key==='ArrowRight'?1:-1)+visible.length)%visible.length];
      chooseDashboard(next.dataset.dashboard);next.focus();
    });
  }
  function renderDetails(item,equipment,reported){
    details.replaceChildren();
    if(!item||typeof item!=='object')return;
    const heading=document.createElement('div'),title=document.createElement('h2'),name=document.createElement('span');
    heading.className='panel-heading';title.className='monitor-details-name';name.textContent=item.name;name.setAttribute('data-i18n-skip','');
    if(equipment){
      const status=document.createElement('span'),value=reported==='normal'||reported==='error'?reported:'disconnected';
      const caption={normal:'통신 정상',error:'통신 에러',disconnected:'통신 연결 끊김'}[value];
      status.className='communication-status communication-status-'+value;status.setAttribute('role','img');status.setAttribute('aria-label',caption);status.setAttribute('title',caption);title.append(status);
    }
    title.append(name);heading.append(title);details.append(heading);
    if(!equipment)return;
    const metrics=document.createElement('dl');metrics.className='monitor-details-metrics';
    const readings=root.FEMSMonitoringMock?.values(item);
    for(const [index,caption] of root.FEMSCatalog.billboardMetrics(item.type).entries()){
      const row=document.createElement('div'),term=document.createElement('dt'),value=document.createElement('dd');
      term.setAttribute('data-i18n-ui','');term.textContent=caption;value.textContent=readings?.[index]??'—';row.append(term,value);metrics.append(row);
    }
    details.append(metrics);
  }
  function selection(selected,equipment=false,reported){
    const open=mode==='monitoring'&&!!selected&&equipment;
    renderDetails(open?selected:null,equipment,reported);
    document.body.classList.toggle('monitor-details-open',open);
    details.inert=!open;details.setAttribute('aria-hidden',String(!open));
  }
  const api={get mode(){return mode;},configure(value){adapter=value;},selection,renderDashboard,
    locateEquipment(id){return mode==='monitoring'&&adapter?.locateEquipment?.(id)===true;},
    setMode(next){
      if(!adapter||!['editor','monitoring'].includes(next)||next===mode)return false;
      if(adapter.beforeChange(next)===false)return false;
      root.dispatchEvent(new CustomEvent('fems-workspace-mode-changing'));
      mode=next;document.body.dataset.workspaceMode=mode;
      for(const element of document.querySelectorAll(editorOnly)){
        if(mode==='monitoring'){priorInert.set(element,element.inert);element.inert=true;}
        else{element.inert=priorInert.get(element)||false;}
      }
      if(mode==='editor')priorInert.clear();
      selection(false);
      for(const button of document.querySelectorAll('[data-workspace-mode]'))button.setAttribute('aria-pressed',String(button.dataset.workspaceMode===mode));
      adapter.afterChange(next);root.dispatchEvent(new CustomEvent('fems-workspace-mode-change',{detail:{mode}}));return true;
    }
  };
  root.FEMSWorkspaceMode=api;
})(window);
