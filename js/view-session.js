(function(root){
  'use strict';
  // Per-tab presentation state. Never stored in or applied to the project drawing.
  const KEY='fems-view-session-v1';
  const number=(value,min,max)=>typeof value==='number'&&Number.isFinite(value)&&value>=min&&value<=max;
  function camera(value){
    if(!value||!number(value.radius,.01,1e8)||!number(value.pitch,0,Math.PI/2)||
      !['yaw','planYaw'].every(key=>number(value[key],-1e8,1e8))||
      !['x','y','z'].every(key=>number(value.target?.[key],-1e8,1e8)))return null;
    return {radius:value.radius,pitch:value.pitch,yaw:value.yaw,planYaw:value.planYaw,target:{x:value.target.x,y:value.target.y,z:value.target.z}};
  }
  function screen(value,project){
    if(!value||!['3d','plan','schematic'].includes(value.view))return null;
    const equipment=new Set(project.equipment.map(item=>item.id));
    const floor=project.floors?.find(item=>item.id===value.context?.floorId);
    const building=project.buildings?.find(item=>item.id===(floor?.buildingId||value.context?.buildingId));
    const context=floor?{floorId:floor.id,...(building?{buildingId:building.id}:{})}:building?{buildingId:building.id}:{};
    const selectedIds=Array.isArray(value.selectedIds)?[...new Set(value.selectedIds.filter(id=>equipment.has(id)))]:[];
    const validSpace=id=>id==='@site'||project.floors?.some(item=>item.id===id)||project.buildings?.some(item=>item.id===id);
    const diagram=value.diagram;
    return {view:value.view,sceneMode:value.sceneMode==='plan'?'plan':'3d',context,selectedIds,spaceSelected:validSpace(value.spaceSelected)?value.spaceSelected:null,
      projectSelected:value.projectSelected===true,camera:camera(value.camera),showLabels:value.showLabels!==false,
      diagram:diagram&&number(diagram.scale,.05,3)&&number(diagram.offset?.x,-1e8,1e8)&&number(diagram.offset?.y,-1e8,1e8)?
        {scale:diagram.scale,offset:{x:diagram.offset.x,y:diagram.offset.y},fitted:diagram.fitted===true,search:typeof diagram.search==='string'?diagram.search.slice(0,1000):'',neighbors:diagram.neighbors===true}:null};
  }
  function read(storage,project){
    try{
      const value=JSON.parse(storage.getItem(KEY));
      if(value?.version!==1||value.projectId!==project.project?.id)return null;
      const current=screen(value,project);if(!current)return null;
      return {...current,mode:value.mode==='monitoring'?'monitoring':'editor',editor:screen(value.editor,project),
        dashboard:['overview','solar','ess','ups'].includes(value.dashboard)?value.dashboard:'overview',
        dashboardScroll:number(value.dashboardScroll,0,1e7)?value.dashboardScroll:0};
    }catch{return null;}
  }
  function save(storage,project,snapshot){
    try{storage.setItem(KEY,JSON.stringify({...snapshot,version:1,projectId:project.project.id}));return true;}
    catch{return false;}
  }
  root.FEMSViewSession={read,save};
})(window);
