// Loaded by the isolated fixture server only, never by the production application.
window.FEMSScene=class extends window.FEMSScene{
  constructor(...args){super(...args);window.testScene=this;}
};
window.FEMSModel.History=class extends window.FEMSModel.History{
  constructor(...args){super(...args);window.testHistory=this;}
};
