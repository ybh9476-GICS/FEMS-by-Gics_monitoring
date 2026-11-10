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
  function selection(selected){
    const open=mode==='monitoring'&&!!selected;
    document.body.classList.toggle('monitor-details-open',open);
    details.inert=!open;details.setAttribute('aria-hidden',String(!open));
  }
  const api={get mode(){return mode;},configure(value){adapter=value;},selection,renderDashboard,
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
      adapter.afterChange(next);return true;
    }
  };
  root.FEMSWorkspaceMode=api;
})(window);
